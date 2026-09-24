import { cn } from "@/lib/utils";

/**
 * Order status without colour. The palette has no green or red to lean on, so
 * status is carried by fill and weight instead: the active state is solid
 * black, terminal states are outlined, and cancelled is struck through.
 */
export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "type-wide inline-flex shrink-0 items-center border px-3 py-1.5 text-[0.625rem] tracking-wide-caps uppercase",
        status === "pending" && "border-ink bg-ink text-paper",
        status === "shipped" && "border-ink text-ink",
        status === "delivered" && "border-line text-muted",
        status === "cancelled" && "border-line text-subtle line-through",
      )}
    >
      {status}
    </span>
  );
}
