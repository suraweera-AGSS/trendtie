import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models";
import { conflict, jsonCreated, jsonOk, parseJson, parseQuery, route } from "@/lib/api";
import { productCreateSchema, productListQuerySchema } from "@/lib/validation";
import { requirePermission } from "@/lib/guards";
import { listProducts, toProductDTO } from "@/lib/catalogue";
import { slugify } from "@/lib/utils";

/** GET /api/admin/products — same catalogue query, admin-only. */
export const GET = route(async (request: NextRequest) => {
  await requirePermission("products:read");
  const query = parseQuery(new URL(request.url), productListQuerySchema);
  return jsonOk(await listProducts(query));
});

/**
 * POST /api/admin/products — create a product.
 *
 * The slug is derived from the name when not supplied, and any stock entry
 * for a size the product is not offered in is dropped rather than silently
 * stored, which would otherwise make a product look available in a size the
 * size selector never shows.
 */
export const POST = route(async (request: Request) => {
  await requirePermission("products:write");
  const input = await parseJson(request, productCreateSchema);

  await connectToDatabase();

  const slug = input.slug ?? slugify(input.name);

  const existing = await Product.findOne({ slug }).select("_id");
  if (existing) {
    throw conflict("A product with that slug already exists.", {
      slug: ["Already in use."],
    });
  }

  const stockPerSize: Record<string, number> = {};
  for (const size of input.sizes) {
    stockPerSize[size] = input.stockPerSize?.[size] ?? 0;
  }

  const product = await Product.create({
    ...input,
    slug,
    stockPerSize,
  });

  return jsonCreated({ product: toProductDTO(product.toObject()) });
});
