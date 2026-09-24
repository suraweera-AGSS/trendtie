import type { SortOrder } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models";
import type { ProductListQuery } from "@/lib/validation";
import type { Category, Size } from "@/lib/site-config";

/**
 * Catalogue reads. Route handlers and server components both go through here
 * so the listing rules (what "in stock" means, how sorting works, what a
 * product looks like once serialised) are defined exactly once.
 */

export type ProductDTO = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  images: { url: string; alt: string; width?: number; height?: number }[];
  sizes: Size[];
  stockPerSize: Partial<Record<Size, number>>;
  category: Category;
  featured: boolean;
  totalStock: number;
  inStock: boolean;
  createdAt: string;
};

type LeanProduct = {
  _id: unknown;
  slug: string;
  name: string;
  description: string;
  price: number;
  images?: { url: string; alt: string; width?: number | null; height?: number | null }[];
  sizes?: string[];
  stockPerSize?: Map<string, number> | Record<string, number>;
  category: string;
  featured?: boolean;
  createdAt?: Date;
};

/**
 * Mongoose returns `stockPerSize` as a Map from a document and as a plain
 * object from `.lean()`. Normalising here keeps every caller from caring.
 */
function normaliseStock(
  value: LeanProduct["stockPerSize"],
): Partial<Record<Size, number>> {
  if (!value) return {};
  const entries =
    value instanceof Map ? [...value.entries()] : Object.entries(value);
  const out: Partial<Record<Size, number>> = {};
  for (const [size, quantity] of entries) {
    out[size as Size] = Number(quantity) || 0;
  }
  return out;
}

export function toProductDTO(doc: LeanProduct): ProductDTO {
  const stockPerSize = normaliseStock(doc.stockPerSize);
  const totalStock = Object.values(stockPerSize).reduce(
    (sum, quantity) => sum + (quantity ?? 0),
    0,
  );

  return {
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    description: doc.description,
    price: doc.price,
    images: (doc.images ?? []).map((image) => ({
      url: image.url,
      alt: image.alt,
      width: image.width ?? undefined,
      height: image.height ?? undefined,
    })),
    sizes: (doc.sizes ?? []) as Size[],
    stockPerSize,
    category: doc.category as Category,
    featured: Boolean(doc.featured),
    totalStock,
    inStock: totalStock > 0,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
  };
}

const SORTS: Record<ProductListQuery["sort"], Record<string, SortOrder>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  "price-asc": { price: 1 },
  "price-desc": { price: -1 },
  name: { name: 1 },
};

export type ProductListResult = {
  items: ProductDTO[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

export async function listProducts(
  query: ProductListQuery,
): Promise<ProductListResult> {
  await connectToDatabase();

  const filter: Record<string, unknown> = {};

  if (query.category) filter.category = query.category;
  if (query.featured !== undefined) filter.featured = query.featured;

  // Filtering by size means "offered in that size", and when combined with
  // inStock it tightens to "available in that size right now".
  if (query.size) {
    filter.sizes = query.size;
    if (query.inStock) filter[`stockPerSize.${query.size}`] = { $gt: 0 };
  } else if (query.inStock) {
    // Any size with stock left. $expr lets us sum the map values server-side.
    filter.$expr = {
      $gt: [
        {
          $sum: {
            $map: {
              input: { $objectToArray: { $ifNull: ["$stockPerSize", {}] } },
              as: "entry",
              in: "$$entry.v",
            },
          },
        },
        0,
      ],
    };
  }

  if (query.search) {
    // Escaped so a search for "a+b" cannot inject regex syntax.
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } },
    ];
  }

  const skip = (query.page - 1) * query.limit;

  const [docs, total] = await Promise.all([
    Product.find(filter)
      .sort(SORTS[query.sort])
      .skip(skip)
      .limit(query.limit)
      .lean<LeanProduct[]>(),
    Product.countDocuments(filter),
  ]);

  return {
    items: docs.map(toProductDTO),
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    limit: query.limit,
  };
}

export async function getProductBySlug(slug: string): Promise<ProductDTO | null> {
  await connectToDatabase();
  const doc = await Product.findOne({ slug }).lean<LeanProduct>();
  return doc ? toProductDTO(doc) : null;
}

export async function getProductById(id: string): Promise<ProductDTO | null> {
  await connectToDatabase();
  const doc = await Product.findById(id).lean<LeanProduct>();
  return doc ? toProductDTO(doc) : null;
}

/** Same category first, falling back to anything else, excluding itself. */
export async function getRelatedProducts(
  product: ProductDTO,
  limit = 4,
): Promise<ProductDTO[]> {
  await connectToDatabase();

  const sameCategory = await Product.find({
    category: product.category,
    _id: { $ne: product.id },
  })
    .sort({ featured: -1, createdAt: -1 })
    .limit(limit)
    .lean<LeanProduct[]>();

  if (sameCategory.length >= limit) return sameCategory.map(toProductDTO);

  const exclude = [product.id, ...sameCategory.map((d) => String(d._id))];
  const filler = await Product.find({ _id: { $nin: exclude } })
    .sort({ featured: -1, createdAt: -1 })
    .limit(limit - sameCategory.length)
    .lean<LeanProduct[]>();

  return [...sameCategory, ...filler].map(toProductDTO);
}

export async function getFeaturedProducts(limit = 4): Promise<ProductDTO[]> {
  await connectToDatabase();
  const docs = await Product.find({ featured: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<LeanProduct[]>();
  return docs.map(toProductDTO);
}
