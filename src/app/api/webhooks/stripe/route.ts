import type Stripe from "stripe";
import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models";
import { getStripe } from "@/lib/stripe";
import { releaseStock } from "@/lib/cart";
import type { Size } from "@/lib/site-config";

/**
 * POST /api/webhooks/stripe
 *
 * Signature verification is mandatory: without it anyone who knows the URL
 * could mark orders paid. The raw body is required for that check, so this
 * handler reads text() rather than json().
 *
 * Handlers are written to be idempotent because Stripe retries deliveries,
 * and a retried `payment_intent.succeeded` must not move an order twice.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    return Response.json(
      { error: { code: "stripe_not_configured", message: "Webhooks are not configured." } },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json(
      { error: { code: "bad_request", message: "Missing stripe-signature header." } },
      { status: 400 },
    );
  }

  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch {
    // Do not echo the verification failure; it only helps an attacker probe.
    return Response.json(
      { error: { code: "invalid_signature", message: "Signature verification failed." } },
      { status: 400 },
    );
  }

  await connectToDatabase();

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        // Conditional on still being pending, so a retry is a no-op.
        await Order.updateOne(
          { stripePaymentIntentId: intent.id, status: "pending" },
          { $set: { status: "pending", paidAt: new Date() } },
        );
        break;
      }

      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const intent = event.data.object;
        const order = await Order.findOne({
          stripePaymentIntentId: intent.id,
          status: { $ne: "cancelled" },
        }).lean();

        if (order) {
          const result = await Order.updateOne(
            { _id: order._id, status: { $ne: "cancelled" } },
            { $set: { status: "cancelled" } },
          );
          // Only the request that actually flipped the status returns stock.
          if (result.modifiedCount === 1) {
            await releaseStock(
              (order.items ?? []).map((item) => ({
                productId: String(item.productId),
                size: item.size as Size,
                quantity: item.quantity,
              })),
            );
          }
        }
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (error) {
    console.error("[stripe webhook] handler failed:", error);
    // 500 tells Stripe to retry, which is what we want for a transient fault.
    return Response.json(
      { error: { code: "handler_failed", message: "Could not process event." } },
      { status: 500 },
    );
  }

  return Response.json({ received: true, type: event.type });
}
