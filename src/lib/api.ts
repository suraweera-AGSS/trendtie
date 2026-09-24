import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

/**
 * Shared plumbing for route handlers: one response shape, one error shape,
 * and one place that decides which failures are safe to describe to a client.
 *
 * Every handler is wrapped in `route()`, so an unexpected throw becomes a 500
 * with a logged cause rather than an unhandled rejection and a hung request.
 */

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    /** Field-level problems, keyed by path, for form rendering. */
    details?: Record<string, string[]>;
  };
};

/** An error a handler raises deliberately, safe to show to the caller. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: Record<string, string[]>) =>
  new ApiError(400, "bad_request", message, details);
export const unauthorized = (message = "You must be signed in.") =>
  new ApiError(401, "unauthorized", message);
export const forbidden = (message = "You do not have access to this.") =>
  new ApiError(403, "forbidden", message);
export const notFound = (message = "Not found.") =>
  new ApiError(404, "not_found", message);
export const conflict = (message: string, details?: Record<string, string[]>) =>
  new ApiError(409, "conflict", message, details);
export const unprocessable = (message: string, details?: Record<string, string[]>) =>
  new ApiError(422, "unprocessable", message, details);

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

function zodDetails(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    const body: ApiErrorBody = {
      error: { code: error.code, message: error.message, details: error.details },
    };
    return NextResponse.json(body, { status: error.status });
  }

  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: "bad_request",
        message: "The request body is invalid.",
        details: zodDetails(error),
      },
    };
    return NextResponse.json(body, { status: 400 });
  }

  // Mongoose duplicate key. Surfacing which field collided is safe and useful;
  // surfacing the driver's raw message is not.
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  ) {
    const key = Object.keys(
      (error as { keyPattern?: Record<string, unknown> }).keyPattern ?? {},
    );
    const body: ApiErrorBody = {
      error: {
        code: "conflict",
        message: "That value is already taken.",
        details: key.length ? { [key[0]]: ["Already in use."] } : undefined,
      },
    };
    return NextResponse.json(body, { status: 409 });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "ValidationError"
  ) {
    const errors = (error as { errors?: Record<string, { message: string }> }).errors ?? {};
    const details: Record<string, string[]> = {};
    for (const [path, issue] of Object.entries(errors)) details[path] = [issue.message];
    const body: ApiErrorBody = {
      error: { code: "unprocessable", message: "Validation failed.", details },
    };
    return NextResponse.json(body, { status: 422 });
  }

  // Anything left is a bug. Log the real cause, return something generic.
  console.error("[api] unhandled error:", error);
  const body: ApiErrorBody = {
    error: { code: "internal_error", message: "Something went wrong." },
  };
  return NextResponse.json(body, { status: 500 });
}

/** Wrap a route handler so every failure path produces a JSON error. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Parse a JSON body against a schema, raising a 400 on malformed input. */
export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("Expected a JSON body.");
  }
  return schema.parse(raw);
}

/** Parse query parameters against a schema. */
export function parseQuery<T>(url: URL, schema: ZodType<T>): T {
  const params: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) params[key] = value;
  return schema.parse(params);
}
