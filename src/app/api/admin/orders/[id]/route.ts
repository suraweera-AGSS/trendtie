import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models";
import { badRequest, jsonOk, notFound, parseJson, route } from "@/lib/api";
import { objectIdSchema, orderStatusUpdateSchema } from "@/lib/validation";
import { requirePermission } from "@/lib/guards";
import { serialiseOrder } from "@/lib/orders";
import { releaseStock } from "@/lib/cart";
import type { Size } from "@/lib/site-config";

type Context = { params: Promise<{ id: string }> };

/** GET /api/admin/orders/[id] */
export const GET = route(async (_request: Request, context: Context) => {
  await requirePermission("orders:read");
  const { id } = await context.params;
  if (!objectIdSchema.safeParse(id).success) {
    throw badRequest("That is not a valid order id.");
  }

  await connectToDatabase();
  const order = await Order.findById(id).populate("userId", "name email").lean();
  if (!order) throw notFound("No such order.");

  return jsonOk({ order: serialiseOrder(order) });
});

/**
 * PATCH /api/admin/orders/[id] — move an order through its lifecycle.
 *
 * Cancelling returns the order's stock to the catalogue, and only once: the
 * status update is conditional on the order not already being cancelled, so a
 * double click cannot credit the same units twice.
 */
export const PATCH = route(async (request: Request, context: Context) => {
  await requirePermission("orders:update");
  const { id } = await context.params;
  if (!objectIdSchema.safeParse(id).success) {
    throw badRequest("That is not a valid order id.");
  }

  const { status } = await parseJson(request, orderStatusUpdateSchema);

  // Cancelling restocks the catalogue, so it is gated separately from simply
  // moving an order along the fulfilment path.
  if (status === "cancelled") await requirePermission("orders:cancel");

  await connectToDatabase();

  const existing = await Order.findById(id).lean();
  if (!existing) throw notFound("No such order.");

  if (status === "cancelled" && existing.status !== "cancelled") {
    const updated = await Order.findOneAndUpdate(
      { _id: id, status: { $ne: "cancelled" } },
      { $set: { status } },
      { returnDocument: "after" },
    ).lean();

    // Another request cancelled it first; its stock is already back.
    if (!updated) {
      const current = await Order.findById(id).lean();
      return jsonOk({ order: serialiseOrder(current!) });
    }

    await releaseStock(
      (existing.items ?? []).map((item) => ({
        productId: String(item.productId),
        size: item.size as Size,
        quantity: item.quantity,
      })),
    );

    return jsonOk({ order: serialiseOrder(updated) });
  }

  const updated = await Order.findByIdAndUpdate(
    id,
    { $set: { status } },
    { returnDocument: "after" },
  ).lean();

  return jsonOk({ order: serialiseOrder(updated!) });
});
