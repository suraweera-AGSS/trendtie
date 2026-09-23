/**
 * Typed, fail-fast access to server-side environment variables.
 * Values are read lazily so that a missing key only throws in the code
 * path that actually needs it, keeping the scaffold runnable before the
 * database, auth, Stripe and Cloudinary steps are wired up.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  get mongodbUri() {
    return required("MONGODB_URI");
  },
  get nextAuthSecret() {
    return required("NEXTAUTH_SECRET");
  },
  get stripeSecretKey() {
    return required("STRIPE_SECRET_KEY");
  },
  get stripeWebhookSecret() {
    return required("STRIPE_WEBHOOK_SECRET");
  },
  get cloudinaryCloudName() {
    return required("CLOUDINARY_CLOUD_NAME");
  },
  get cloudinaryApiKey() {
    return required("CLOUDINARY_API_KEY");
  },
  get cloudinaryApiSecret() {
    return required("CLOUDINARY_API_SECRET");
  },
};
