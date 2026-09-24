import type { Metadata } from "next";
import Link from "next/link";
import { DashboardCharts } from "@/components/admin/dashboard-charts";
import { getSessionUser } from "@/lib/guards";
import { can } from "@/lib/permissions";
import { connectToDatabase } from "@/lib/db";
import { Order, Product, User } from "@/models";
import { serialiseOrder } from "@/lib/orders";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Dashboard.
 *
 * Staff see the operational half — recent orders and what needs picking —
 * while the charts, which are revenue reporting, are gated on
 * `analytics:view`. Fulfilment does not need to know the shop's takings.
 */
export default async function AdminDashboard() {
  const user = await getSessionUser();
  const showAnalytics = can(user?.role, "analytics:view");

  await connectToDatabase();

  const [recent, pendingCount, lowStock, productCount, customerCount] =
    await Promise.all([
      Order.find().sort({ createdAt: -1 }).limit(6).populate("userId", "name email").lean(),
      Order.countDocuments({ status: "pending" }),
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
        { $match: { stock: { $lt: 12 } } },
        { $sort: { stock: 1 } },
        { $limit: 6 },
      ]),
      Product.countDocuments(),
      User.countDocuments({ role: "customer" }),
    ]);

  return (
    <div className="px-6 py-10 lg:px-10 lg:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">Overview</p>
          <h1 className="mt-4 text-title">Dashboard</h1>
        </div>
        <p className="text-xs text-muted">
          {pendingCount} order{pendingCount === 1 ? "" : "s"} awaiting fulfilment
        </p>
      </header>

      {showAnalytics ? (
        <DashboardCharts />
      ) : (
        <div className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2">
          <div className="bg-paper p-6">
            <p className="eyebrow text-muted">Products</p>
            <p className="mt-3 text-3xl font-semibold">{productCount}</p>
          </div>
          <div className="bg-paper p-6">
            <p className="eyebrow text-muted">Customers</p>
            <p className="mt-3 text-3xl font-semibold">{customerCount}</p>
          </div>
        </div>
      )}

      <div className="mt-12 grid gap-8 xl:grid-cols-[1.6fr_1fr]">
        <section className="border border-line p-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="type-wide text-sm font-semibold">Recent orders</h2>
            <Link
              href="/admin/orders"
              className="underline-draw type-wide text-[0.625rem] tracking-wide-caps uppercase"
            >
              View all
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No orders yet.</p>
          ) : (
            <ul className="mt-6 border-t border-line">
              {recent.map((doc) => {
                const order = serialiseOrder(doc);
                const customer = doc.userId as unknown as {
                  name?: string;
                  email?: string;
                } | null;
                return (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {customer?.name ?? "Unknown customer"}
                      </p>
                      <p className="eyebrow mt-1.5 text-muted">
                        {order.itemCount} items ·{" "}
                        {new Date(order.createdAt).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm tabular-nums">
                        {formatPrice(order.total)}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="border border-line p-6">
          <h2 className="type-wide text-sm font-semibold">Needs restocking</h2>
          <p className="mt-1.5 text-xs text-muted">Under 12 units left</p>

          {lowStock.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Everything is comfortably stocked.
            </p>
          ) : (
            <ul className="mt-6 border-t border-line">
              {lowStock.map((product) => (
                <li
                  key={String(product._id)}
                  className="flex items-center justify-between gap-4 border-b border-line py-3.5"
                >
                  <Link
                    href={`/products/${product.slug}`}
                    className="underline-draw min-w-0 truncate text-sm"
                  >
                    {product.name}
                  </Link>
                  <span
                    className={
                      product.stock === 0
                        ? "shrink-0 text-sm tabular-nums line-through"
                        : "shrink-0 text-sm tabular-nums"
                    }
                  >
                    {product.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
