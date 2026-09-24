import { jsonOk, notFound, route } from "@/lib/api";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalogue";

type Context = { params: Promise<{ slug: string }> };

/** GET /api/products/[slug] — one product plus its related items. */
export const GET = route(async (_request: Request, context: Context) => {
  const { slug } = await context.params;

  const product = await getProductBySlug(slug);
  if (!product) throw notFound("No product with that slug.");

  const related = await getRelatedProducts(product, 4);

  return jsonOk({ product, related });
});
