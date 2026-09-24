import { connectToDatabase } from "@/lib/db";
import { jsonOk, route } from "@/lib/api";
import { isStripeConfigured } from "@/lib/stripe";

/**
 * GET /api/health — readiness probe.
 *
 * Pings the database rather than only reporting that the process is up, so a
 * green response means the app can actually serve requests.
 */
export const GET = route(async () => {
  const started = Date.now();

  let database: "up" | "down" = "down";
  let latencyMs: number | null = null;
  let error: string | null = null;

  try {
    const mongoose = await connectToDatabase();
    await mongoose.connection.db?.admin().ping();
    database = "up";
    latencyMs = Date.now() - started;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Unknown database error";
  }

  const body = {
    status: database === "up" ? ("ok" as const) : ("degraded" as const),
    database,
    latencyMs,
    error,
    services: {
      stripe: isStripeConfigured() ? "configured" : "not_configured",
      cloudinary: process.env.CLOUDINARY_API_KEY ? "configured" : "not_configured",
    },
  };

  return jsonOk(body, { status: database === "up" ? 200 : 503 });
});
