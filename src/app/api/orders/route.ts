import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models";
import { jsonCreated, jsonOk, parseJson, route, unprocessable } from "@/lib/api";
import { orderCreateSchema } from "@/lib/validation";
import { requireUser } from "@/lib/guards";
import { commitStock, priceCartStrict } from "@/lib/cart";
import { serialiseOrder } from "@/lib/orders";

/** GET /api/orders — the signed-in customer's own order history. */
export const GET = route(async (request: NextRequest) => {
  const user = await requireUser();
  await connectToDatabase();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 25) || 25, 100);

  const orders = await Order.find({ userId: user.id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return jsonOk({ orders: orders.map(serialiseOrder) });
});

/**
 * POST /api/orders — turn a cart into an order.
 *
 * Prices come from the database, never the request. Stock is decremented
 * conditionally before the order is written, and handed back if the write
 * fails, so a crash mid-checkout cannot leave stock consumed by an order that
 * does not exist. Payment is attached separately in the checkout step.
 */
export const POST = route(async (request: Request) => {
  const user = await requireUser();
  const input = await parseJson(request, orderCreateSchema);

  // Throws 422 listing every unavailable line if anything cannot be fulfilled.
  const cart = await priceCartStrict(input.items);

  const stock = await commitStock(
    cart.items.map((item) => ({
      productId: item.productId,
      size: item.size,
      quantity: item.quantity,
    })),
  );

  if (!stock.ok) {
    throw unprocessable(
      "Someone else took the last of an item while you were checking out.",
      Object.fromEntries(
        stock.failed.map((f) => [`${f.productId}.${f.size}`, ["No longer available."]]),
      ),
    );
  }

  try {
    await connectToDatabase();

    const order = await Order.create({
      userId: user.id,
      items: cart.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
      })),
      status: "pending",
      shippingAddress: input.shippingAddress,
      total: cart.subtotal,
      currency: cart.currency,
    });

    return jsonCreated({ order: serialiseOrder(order.toObject()) });
  } catch (error) {
    // The order never landed, so the stock we took belongs back on the shelf.
    const { releaseStock } = await import("@/lib/cart");
    await releaseStock(
      cart.items.map((item) => ({
        productId: item.productId,
        size: item.size,
        quantity: item.quantity,
      })),
    ).catch(() => {});
    throw error;
  }
});
