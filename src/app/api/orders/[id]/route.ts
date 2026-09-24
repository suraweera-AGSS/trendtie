import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models";
import { badRequest, jsonOk, notFound, route } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { requireUser } from "@/lib/guards";
import { serialiseOrder } from "@/lib/orders";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/orders/[id] — one of the signed-in customer's own orders.
 *
 * Ownership is part of the query rather than a check after the fetch, so
 * another customer's order id returns 404 and reveals nothing about whether
 * that order exists.
 */
export const GET = route(async (_request: Request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  if (!objectIdSchema.safeParse(id).success) {
    throw badRequest("That is not a valid order id.");
  }

  await connectToDatabase();

  const order = await Order.findOne({ _id: id, userId: user.id }).lean();
  if (!order) throw notFound("No such order.");

  return jsonOk({ order: serialiseOrder(order) });
});
