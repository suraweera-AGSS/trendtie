import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";
import { connectToDatabase } from "@/lib/db";
import { isStripeConfigured } from "@/lib/stripe";
import { isCloudinaryConfigured } from "@/lib/cloudinary";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Settings and integration status.
 *
 * Read-only for now. It exists so that "why is checkout returning 503" has an
 * answer in the panel rather than only in the server logs.
 */
export default async function AdminSettingsPage() {
  let database: "connected" | "unreachable" = "unreachable";
  let host = "";
  try {
    const mongoose = await connectToDatabase();
    await mongoose.connection.db?.admin().ping();
    database = "connected";
    host = mongoose.connection.host ?? "";
  } catch {
    database = "unreachable";
  }

  const integrations = [
    {
      name: "MongoDB Atlas",
      state: database === "connected" ? "Connected" : "Unreachable",
      ok: database === "connected",
      detail: host || "Set MONGODB_URI in .env.local",
    },
    {
      name: "Stripe",
      state: isStripeConfigured() ? "Configured" : "Not configured",
      ok: isStripeConfigured(),
      detail: isStripeConfigured()
        ? "Test mode keys present"
        : "Checkout returns 503 until STRIPE_SECRET_KEY is set",
    },
    {
      name: "Cloudinary",
      state: isCloudinaryConfigured() ? "Configured" : "Not configured",
      ok: isCloudinaryConfigured(),
      detail: isCloudinaryConfigured()
        ? "Uploads enabled"
        : "Product images are entered as URLs until keys are set",
    },
  ];

  return (
    <div className="px-6 py-10 lg:px-10 lg:py-12">
      <header>
        <p className="eyebrow text-muted">Configuration</p>
        <h1 className="mt-4 text-title">Settings</h1>
      </header>

      <section className="mt-10">
        <h2 className="type-wide text-sm font-semibold">Store</h2>
        <dl className="mt-5 border border-line">
          <div className="flex justify-between gap-4 border-b border-line p-5 text-sm">
            <dt className="text-muted">Name</dt>
            <dd>{siteConfig.name}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line p-5 text-sm">
            <dt className="text-muted">Tagline</dt>
            <dd className="text-right">{siteConfig.tagline}</dd>
          </div>
          <div className="flex justify-between gap-4 p-5 text-sm">
            <dt className="text-muted">Currency</dt>
            <dd>{siteConfig.currency}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="type-wide text-sm font-semibold">Integrations</h2>
        <ul className="mt-5 border border-line">
          {integrations.map((integration) => (
            <li
              key={integration.name}
              className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{integration.name}</p>
                <p className="mt-1 text-xs text-muted">{integration.detail}</p>
              </div>
              {/* State is carried by fill and a word, never colour alone. */}
              <span
                className={
                  integration.ok
                    ? "type-wide shrink-0 border border-ink bg-ink px-3 py-1.5 text-[0.625rem] tracking-wide-caps text-paper uppercase"
                    : "type-wide shrink-0 border border-line px-3 py-1.5 text-[0.625rem] tracking-wide-caps text-muted uppercase"
                }
              >
                {integration.state}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
