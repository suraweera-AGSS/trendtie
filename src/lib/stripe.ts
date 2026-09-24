import Stripe from "stripe";

/**
 * Stripe client.
 *
 * The keys are optional on purpose: everything except payment works without
 * them, so the store can be developed, seeded and demonstrated before a
 * Stripe account exists. Endpoints that genuinely need Stripe call
 * `requireStripe()` and return a clear 503 when it is not configured, rather
 * than throwing an opaque error at request time.
 */

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe | null {
  if (!isStripeConfigured()) return null;
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    });
  }
  return client;
}

export class StripeNotConfiguredError extends Error {
  readonly status = 503;
  readonly code = "stripe_not_configured";
  constructor() {
    super(
      "Payments are not configured. Add STRIPE_SECRET_KEY to .env.local to enable checkout.",
    );
    this.name = "StripeNotConfiguredError";
  }
}

export function requireStripe(): Stripe {
  const stripe = getStripe();
  if (!stripe) throw new StripeNotConfiguredError();
  return stripe;
}
