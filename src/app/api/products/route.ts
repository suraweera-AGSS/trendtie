import type { NextRequest } from "next/server";
import { jsonOk, parseQuery, route } from "@/lib/api";
import { productListQuerySchema } from "@/lib/validation";
import { listProducts } from "@/lib/catalogue";

/**
 * GET /api/products — the public catalogue.
 *
 * Supports category, size, search, featured and inStock filters, five sort
 * orders and pagination. See `productListQuerySchema` for the exact contract.
 */
export const GET = route(async (request: NextRequest) => {
  const query = parseQuery(new URL(request.url), productListQuerySchema);
  const result = await listProducts(query);
  return jsonOk(result);
});
