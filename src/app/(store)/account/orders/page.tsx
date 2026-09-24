import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { getSessionUser } from "@/lib/guards";
import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models";
import { serialiseOrder } from "@/lib/orders";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/account/orders");

  await connectToDatabase();
  const docs = await Order.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
  const orders = docs.map(serialiseOrder);

  return (
    <Container className="py-16 lg:py-24">
      <p className="eyebrow text-muted">Account</p>
      <h1 className="mt-5 text-hero">Order history</h1>

      {orders.length === 0 ? (
        <div className="mt-16 border border-line p-12 text-center">
          <h2 className="text-title">No orders yet.</h2>
          <p className="mx-auto mt-4 max-w-measure text-muted">
            When you place an order it will appear here with its status.
          </p>
          <Link href="/products" className={buttonClasses("solid", "md", "mt-8")}>
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="mt-12 flex flex-col gap-6">
          {orders.map((order) => (
            <li key={order.id} className="border border-line p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-muted">
                    {new Date(order.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="mt-2 text-sm tabular-nums text-muted">
                    Reference {order.id}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              <ul className="mt-6 flex flex-col gap-2 border-t border-line pt-5 text-sm">
                {order.items.map((item, index) => (
                  <li key={index} className="flex justify-between gap-4">
                    <span>
                      {item.name}
                      <span className="text-muted">
                        {" "}
                        · {item.size === "ONE_SIZE" ? "One size" : item.size} ×{" "}
                        {item.quantity}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatPrice(item.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex justify-between border-t border-line pt-5">
                <span className="type-wide text-sm font-semibold">Total</span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatPrice(order.total)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
