import { connectToDatabase } from "@/lib/db";
import { Order, Product, User } from "@/models";
import { jsonOk, route } from "@/lib/api";
import { requirePermission } from "@/lib/guards";

/**
 * GET /api/admin/stats — dashboard figures.
 *
 * Revenue counts orders that were not cancelled, and is summed in the
 * database rather than by loading every order into memory.
 */
export const GET = route(async () => {
  await requirePermission("dashboard:view");
  await connectToDatabase();

  const [products, orders, customers, revenueRows, statusRows, lowStock] =
    await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      User.countDocuments({ role: "customer" }),
      Order.aggregate<{ _id: null; total: number }>([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Order.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Product.aggregate<{ _id: unknown; name: string; slug: string; total: number }>([
        {
          $addFields: {
            total: {
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
        { $match: { total: { $lt: 10 } } },
        { $sort: { total: 1 } },
        { $limit: 5 },
        { $project: { name: 1, slug: 1, total: 1 } },
      ]),
    ]);

  const byStatus: Record<string, number> = {};
  for (const row of statusRows) byStatus[row._id] = row.count;

  return jsonOk({
    products,
    orders,
    customers,
    revenue: revenueRows[0]?.total ?? 0,
    currency: "USD",
    ordersByStatus: byStatus,
    lowStock: lowStock.map((p) => ({
      id: String(p._id),
      name: p.name,
      slug: p.slug,
      totalStock: p.total,
    })),
  });
});
