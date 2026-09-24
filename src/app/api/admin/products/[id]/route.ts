import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models";
import { badRequest, conflict, jsonOk, notFound, parseJson, route } from "@/lib/api";
import { objectIdSchema, productUpdateSchema } from "@/lib/validation";
import { requirePermission } from "@/lib/guards";
import { toProductDTO } from "@/lib/catalogue";

type Context = { params: Promise<{ id: string }> };

async function requireValidId(context: Context) {
  const { id } = await context.params;
  if (!objectIdSchema.safeParse(id).success) {
    throw badRequest("That is not a valid product id.");
  }
  return id;
}

/** GET /api/admin/products/[id] */
export const GET = route(async (_request: Request, context: Context) => {
  await requirePermission("products:read");
  const id = await requireValidId(context);

  await connectToDatabase();
  const product = await Product.findById(id).lean();
  if (!product) throw notFound("No such product.");

  return jsonOk({ product: toProductDTO(product) });
});

/**
 * PATCH /api/admin/products/[id] — partial update.
 *
 * When the size list changes, stock is rebuilt against the new list so that
 * removing a size also removes its stock rather than leaving an orphaned
 * entry that keeps counting toward totals.
 */
export const PATCH = route(async (request: Request, context: Context) => {
  await requirePermission("products:write");
  const id = await requireValidId(context);
  const input = await parseJson(request, productUpdateSchema);

  await connectToDatabase();

  const product = await Product.findById(id);
  if (!product) throw notFound("No such product.");

  if (input.slug && input.slug !== product.slug) {
    const clash = await Product.findOne({ slug: input.slug, _id: { $ne: id } }).select("_id");
    if (clash) {
      throw conflict("A product with that slug already exists.", {
        slug: ["Already in use."],
      });
    }
  }

  const nextSizes = input.sizes ?? product.sizes;

  if (input.sizes || input.stockPerSize) {
    const rebuilt = new Map<string, number>();
    for (const size of nextSizes) {
      const fromInput = input.stockPerSize?.[size as keyof typeof input.stockPerSize];
      const existing = product.stockPerSize?.get(size);
      rebuilt.set(size, fromInput ?? existing ?? 0);
    }
    product.stockPerSize = rebuilt;
  }

  if (input.name !== undefined) product.name = input.name;
  if (input.slug !== undefined) product.slug = input.slug;
  if (input.description !== undefined) product.description = input.description;
  if (input.price !== undefined) product.price = input.price;
  // set() casts the plain array into the schema document array.
  if (input.images !== undefined) product.set("images", input.images);
  if (input.sizes !== undefined) product.sizes = input.sizes;
  if (input.category !== undefined) product.category = input.category;
  if (input.featured !== undefined) product.featured = input.featured;

  await product.save();

  return jsonOk({ product: toProductDTO(product.toObject()) });
});

/** DELETE /api/admin/products/[id] */
export const DELETE = route(async (_request: Request, context: Context) => {
  await requirePermission("products:delete");
  const id = await requireValidId(context);

  await connectToDatabase();
  const deleted = await Product.findByIdAndDelete(id).lean();
  if (!deleted) throw notFound("No such product.");

  return jsonOk({ deleted: true, id });
});
