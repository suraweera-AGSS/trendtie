import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models";
import { ApiError, badRequest, jsonOk, notFound, parseJson, route } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { requireUser } from "@/lib/guards";
import { isStripeConfigured, requireStripe } from "@/lib/stripe";
import { z } from "zod";

const checkoutSchema = z.object({ orderId: objectIdSchema });

/**
 * POST /api/checkout — create a Stripe PaymentIntent for an existing order.
 *
 * The amount is read from the stored order, never from the request, so the
 * figure charged is the figure the server calculated when the order was
 * placed. The intent id is written back to the order so the webhook can find
 * it again, and a second call for the same order reuses the existing intent
 * rather than creating a duplicate charge.
 */
export const POST = route(async (request: Request) => {
  const user = await requireUser();
  const { orderId } = await parseJson(request, checkoutSchema);

  if (!isStripeConfigured()) {
    throw new ApiError(
      503,
      "stripe_not_configured",
      "Payments are not configured. Add STRIPE_SECRET_KEY to .env.local to enable checkout.",
    );
  }

  await connectToDatabase();

  const order = await Order.findOne({ _id: orderId, userId: user.id });
  if (!order) throw notFound("No such order.");
  if (order.status === "cancelled") throw badRequest("That order was cancelled.");

  const stripe = requireStripe();

  if (order.stripePaymentIntentId) {
    const existing = await stripe.paymentIntents.retrieve(
      order.stripePaymentIntentId,
    );
    if (existing.status !== "canceled") {
      return jsonOk({
        clientSecret: existing.client_secret,
        paymentIntentId: existing.id,
        amount: order.total,
        currency: order.currency,
        reused: true,
      });
    }
  }

  const intent = await stripe.paymentIntents.create({
    amount: order.total,
    currency: (order.currency ?? "USD").toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      orderId: String(order._id),
      userId: user.id,
    },
  });

  order.stripePaymentIntentId = intent.id;
  await order.save();

  return jsonOk({
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    amount: order.total,
    currency: order.currency,
    reused: false,
  });
});
