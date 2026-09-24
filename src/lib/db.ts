import mongoose from "mongoose";

/**
 * Mongoose connection helper.
 *
 * Next.js reloads server modules on every edit in development and runs
 * serverless functions that may be reused between invocations in production.
 * Both cases would open a new connection pool each time, and Atlas will
 * eventually refuse them. Caching the connection promise on globalThis keeps
 * exactly one pool alive across reloads and warm invocations.
 */

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var __mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis.__mongooseCache ?? {
  conn: null,
  promise: null,
};

globalThis.__mongooseCache = cached;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    // Read lazily rather than at module scope so that scripts which load
    // their env file before importing this module still work.
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error(
        "MONGODB_URI is not set. Copy .env.example to .env.local and add your Atlas connection string.",
      );
    }

    cached.promise = mongoose.connect(uri, {
      // Fail fast instead of buffering queries against a dead connection.
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Clear the rejected promise so the next call retries instead of
    // replaying the same failure forever.
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

/** Close the pool. Only useful for scripts; the app keeps its pool warm. */
export async function disconnectFromDatabase(): Promise<void> {
  if (!cached.conn) return;
  await cached.conn.disconnect();
  cached.conn = null;
  cached.promise = null;
}
