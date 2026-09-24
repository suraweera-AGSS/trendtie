import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Order, Product, User } from "@/models";
import { jsonOk, parseQuery, route } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/site-config";

const querySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
});

export type RevenuePoint = {
  date: string;
  revenue: number;
  orders: number;
};

/**
 * GET /api/admin/analytics — the numbers behind the dashboard charts.
 *
 * Everything is aggregated in the database rather than by pulling orders into
 * the process and reducing in JavaScript, so the cost does not grow with the
 * order table. The daily series is zero-filled server-side: a day with no
 * orders must appear as a zero, otherwise the line chart silently closes the
 * gap and draws a trend that never happened.
 */
export const GET = route(async (request: NextRequest) => {
  await requirePermission("analytics:view");
  const { days } = parseQuery(new URL(request.url), querySchema);

  await connectToDatabase();

  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  // The window immediately before this one, for period-on-period deltas.
  const previousStart = new Date(start);
  previousStart.setUTCDate(previousStart.getUTCDate() - days);

  const paid = { status: { $ne: "cancelled" } };

  const [
    dailyRows,
    statusRows,
    topProductRows,
    stockRows,
    categoryRows,
    currentTotals,
    previousTotals,
    productCount,
    customerCount,
  ] = await Promise.all([
    Order.aggregate<{ _id: string; revenue: number; orders: number }>([
      { $match: { ...paid, createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" },
          },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Order.aggregate<{ _id: string; count: number; revenue: number }>([
      { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$total" } } },
    ]),

    Order.aggregate<{ _id: string; name: string; units: number; revenue: number }>([
      { $match: paid },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          units: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 6 },
    ]),

    Product.aggregate<{ _id: unknown; name: string; slug: string; stock: number }>([
      {
        $addFields: {
          stock: {
            $sum: {
              $map: {
                input: { $objectToArray: { $ifNull: ["$stockPerSize", {}] } },
                as: "entry",
                in: "$$entry.v",
              },
            },
          },
        },
      },
      { $sort: { stock: 1 } },
      { $project: { name: 1, slug: 1, stock: 1 } },
    ]),

    Product.aggregate<{ _id: string; products: number; stock: number }>([
      {
        $addFields: {
          stock: {
            $sum: {
              $map: {
                input: { $objectToArray: { $ifNull: ["$stockPerSize", {}] } },
                as: "entry",
                in: "$$entry.v",
              },
            },
          },
        },
      },
      { $group: { _id: "$category", products: { $sum: 1 }, stock: { $sum: "$stock" } } },
      { $sort: { _id: 1 } },
    ]),

    Order.aggregate<{ _id: null; revenue: number; orders: number }>([
      { $match: { ...paid, createdAt: { $gte: start } } },
      { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
    ]),

    Order.aggregate<{ _id: null; revenue: number; orders: number }>([
      { $match: { ...paid, createdAt: { $gte: previousStart, $lt: start } } },
      { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
    ]),

    Product.countDocuments(),
    User.countDocuments({ role: "customer" }),
  ]);

  // Zero-fill so every day in the window is present and in order.
  const byDate = new Map(dailyRows.map((row) => [row._id, row]));
  const series: RevenuePoint[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    const row = byDate.get(key);
    series.push({
      date: key,
      revenue: row?.revenue ?? 0,
      orders: row?.orders ?? 0,
    });
  }

  const statusCounts = new Map(statusRows.map((row) => [row._id, row]));
  const ordersByStatus = ORDER_STATUSES.map((status) => ({
    status,
    count: statusCounts.get(status)?.count ?? 0,
    revenue: statusCounts.get(status)?.revenue ?? 0,
  }));

  const current = currentTotals[0] ?? { revenue: 0, orders: 0 };
  const previous = previousTotals[0] ?? { revenue: 0, orders: 0 };

  /** Percentage change, or null when there is no baseline to compare against. */
  const delta = (now_: number, before: number): number | null =>
    before === 0 ? null : Math.round(((now_ - before) / before) * 1000) / 10;

  return jsonOk({
    range: { days, from: series[0]?.date ?? null, to: series.at(-1)?.date ?? null },
    totals: {
      revenue: current.revenue,
      orders: current.orders,
      averageOrderValue:
        current.orders > 0 ? Math.round(current.revenue / current.orders) : 0,
      products: productCount,
      customers: customerCount,
    },
    deltas: {
      revenue: delta(current.revenue, previous.revenue),
      orders: delta(current.orders, previous.orders),
    },
    series,
    ordersByStatus,
    topProducts: topProductRows.map((row) => ({
      productId: String(row._id),
      name: row.name,
      units: row.units,
      revenue: row.revenue,
    })),
    stock: stockRows.map((row) => ({
      id: String(row._id),
      name: row.name,
      slug: row.slug,
      stock: row.stock,
    })),
    stockByCategory: categoryRows.map((row) => ({
      category: row._id,
      products: row.products,
      stock: row.stock,
    })),
    currency: "USD",
  });
});
