"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { ORDER_STATUSES } from "@/lib/site-config";
import type { OrderDTO } from "@/lib/orders";
import { cn, formatPrice } from "@/lib/utils";

type AdminOrder = OrderDTO & {
  customer: { name?: string; email?: string } | null;
};

/**
 * Order queue. Status is changed inline rather than behind a detail page,
 * because the common task is moving several orders along in one sitting.
 * Cancelling is confirmed first: it returns stock to the catalogue and is not
 * something to do by mis-click.
 */
export function OrderManager({ orders }: { orders: AdminOrder[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  async function updateStatus(order: AdminOrder, status: string) {
    if (
      status === "cancelled" &&
      !window.confirm(
        "Cancel this order? The items go back into stock and this cannot be undone.",
      )
    ) {
      return;
    }

    setBusyId(order.id);
    setError(null);

    const response = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Could not update the order.");
    }

    setBusyId(null);
    router.refresh();
  }

  const visible =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title">Orders</h1>
          <p className="mt-3 text-sm text-muted">{orders.length} total</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {["all", ...ORDER_STATUSES].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "type-wide cursor-pointer border px-3 py-1.5 text-[0.625rem] tracking-wide-caps uppercase",
                filter === value
                  ? "border-ink bg-ink text-paper"
                  : "border-line text-muted hover:border-ink",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-6 border border-ink p-4 text-sm">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="mt-10 border border-line p-10 text-center text-sm text-muted">
          No orders with that status.
        </p>
      ) : (
        <ul className="mt-10 flex flex-col gap-5">
          {visible.map((order) => (
            <li key={order.id} className="border border-line p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {order.customer?.name ?? "Unknown customer"}
                  </p>
                  <p className="mt-1.5 text-xs text-muted">
                    {order.customer?.email}
                  </p>
                  <p className="eyebrow mt-3 text-muted">
                    {new Date(order.createdAt).toLocaleString("en-GB")} ·{" "}
                    {order.itemCount} items
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatPrice(order.total)}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>

              <ul className="mt-5 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
                {order.items.map((item, index) => (
                  <li key={index} className="flex justify-between gap-4">
                    <span className="text-muted">
                      {item.name} · {item.size === "ONE_SIZE" ? "One size" : item.size}{" "}
                      × {item.quantity}
                    </span>
                    <span className="tabular-nums">
                      {formatPrice(item.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-5">
                <span className="eyebrow mr-2 text-muted">Move to</span>
                {ORDER_STATUSES.filter((s) => s !== order.status).map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => updateStatus(order, status)}
                    className="type-wide cursor-pointer border border-line px-3 py-1.5 text-[0.625rem] tracking-wide-caps uppercase transition-[border-color,background-color,color] duration-(--duration-quick) ease-out-soft hover:border-ink hover:bg-ink hover:text-paper disabled:opacity-40"
                  >
                    {status}
                  </button>
                ))}
              </div>

              <p className="mt-5 text-xs text-muted">
                Ship to: {order.shippingAddress.fullName},{" "}
                {order.shippingAddress.line1}, {order.shippingAddress.city}{" "}
                {order.shippingAddress.postalCode},{" "}
                {order.shippingAddress.country}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
