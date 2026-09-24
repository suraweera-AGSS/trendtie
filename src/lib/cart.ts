import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models";
import { unprocessable } from "@/lib/api";
import type { Size } from "@/lib/site-config";

/**
 * Cart pricing and stock checking.
 *
 * The client sends product ids, sizes and quantities — never prices. Every
 * figure below is read from the database at request time, so a tampered cart
 * payload cannot change what the customer is charged. This is the single
 * place allowed to decide what a cart costs, and both the cart preview and
 * the order/checkout endpoints call it.
 */

export type CartInputItem = {
  productId: string;
  size: Size;
  quantity: number;
};

export type PricedCartItem = {
  productId: string;
  slug: string;
  name: string;
  size: Size;
  quantity: number;
  /** Unit price in minor units, straight from the database. */
  price: number;
  lineTotal: number;
  image: { url: string; alt: string } | null;
  /** Units available in this size right now. */
  available: number;
};

export type CartIssue = {
  productId: string;
  size: Size;
  code:
    | "product_not_found"
    | "size_unavailable"
    | "out_of_stock"
    | "insufficient_stock";
  message: string;
  available: number;
  requested: number;
};

export type PricedCart = {
  items: PricedCartItem[];
  issues: CartIssue[];
  subtotal: number;
  itemCount: number;
  currency: string;
  valid: boolean;
};

/**
 * Resolve a cart against live catalogue data.
 *
 * Returns both the priced lines and any problems found, rather than throwing
 * on the first one, so the cart page can show every issue at once instead of
 * making the customer fix them one at a time.
 */
export async function priceCart(
  input: CartInputItem[],
  currency = "USD",
): Promise<PricedCart> {
  await connectToDatabase();

  // Merge duplicate lines first: two "black tee, size L" entries are one line
  // of quantity 2, and must be checked against stock as one.
  const merged = new Map<string, CartInputItem>();
  for (const item of input) {
    const key = `${item.productId}:${item.size}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += item.quantity;
    else merged.set(key, { ...item });
  }

  const ids = [...new Set([...merged.values()].map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: ids } });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items: PricedCartItem[] = [];
  const issues: CartIssue[] = [];

  for (const entry of merged.values()) {
    const product = byId.get(entry.productId);

    if (!product) {
      issues.push({
        productId: entry.productId,
        size: entry.size,
        code: "product_not_found",
        message: "That product is no longer available.",
        available: 0,
        requested: entry.quantity,
      });
      continue;
    }

    if (!product.sizes.includes(entry.size)) {
      issues.push({
        productId: entry.productId,
        size: entry.size,
        code: "size_unavailable",
        message: `${product.name} is not offered in size ${entry.size}.`,
        available: 0,
        requested: entry.quantity,
      });
      continue;
    }

    const available = product.stockPerSize?.get(entry.size) ?? 0;

    if (available <= 0) {
      issues.push({
        productId: entry.productId,
        size: entry.size,
        code: "out_of_stock",
        message: `${product.name} in size ${entry.size} is sold out.`,
        available: 0,
        requested: entry.quantity,
      });
      continue;
    }

    if (available < entry.quantity) {
      issues.push({
        productId: entry.productId,
        size: entry.size,
        code: "insufficient_stock",
        message: `Only ${available} left of ${product.name} in size ${entry.size}.`,
        available,
        requested: entry.quantity,
      });
      // Still price the line at what can actually be fulfilled, so the cart
      // can offer "update to the available quantity" in one click.
    }

    const quantity = Math.min(entry.quantity, available);
    const image = product.images?.[0];

    items.push({
      productId: String(product._id),
      slug: product.slug,
      name: product.name,
      size: entry.size,
      quantity,
      price: product.price,
      lineTotal: product.price * quantity,
      image: image ? { url: image.url, alt: image.alt } : null,
      available,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    issues,
    subtotal,
    itemCount,
    currency,
    valid: issues.length === 0 && items.length > 0,
  };
}

/** Price a cart and refuse to continue unless every line is fulfillable. */
export async function priceCartStrict(
  input: CartInputItem[],
  currency = "USD",
): Promise<PricedCart> {
  const cart = await priceCart(input, currency);
  if (!cart.valid) {
    const details: Record<string, string[]> = {};
    for (const issue of cart.issues) {
      details[`${issue.productId}.${issue.size}`] = [issue.message];
    }
    throw unprocessable(
      "Some items are no longer available at the requested quantity.",
      details,
    );
  }
  return cart;
}

/**
 * Decrement stock for a completed order.
 *
 * Each decrement is conditional on there still being enough stock, so two
 * customers checking out the last unit at the same time cannot both succeed:
 * the second update matches no document. Anything that fails is reported back
 * so the caller can roll the order back rather than overselling.
 */
export async function commitStock(
  items: { productId: string; size: Size; quantity: number }[],
): Promise<{ ok: boolean; failed: { productId: string; size: Size }[] }> {
  await connectToDatabase();

  const applied: { productId: string; size: Size; quantity: number }[] = [];
  const failed: { productId: string; size: Size }[] = [];

  for (const item of items) {
    const result = await Product.updateOne(
      {
        _id: item.productId,
        [`stockPerSize.${item.size}`]: { $gte: item.quantity },
      },
      { $inc: { [`stockPerSize.${item.size}`]: -item.quantity } },
    );

    if (result.modifiedCount === 1) applied.push(item);
    else failed.push({ productId: item.productId, size: item.size });
  }

  // Put back whatever was taken if any line could not be satisfied.
  if (failed.length) {
    for (const item of applied) {
      await Product.updateOne(
        { _id: item.productId },
        { $inc: { [`stockPerSize.${item.size}`]: item.quantity } },
      );
    }
    return { ok: false, failed };
  }

  return { ok: true, failed: [] };
}

/** Give stock back, used when an order is cancelled. */
export async function releaseStock(
  items: { productId: string; size: Size; quantity: number }[],
): Promise<void> {
  await connectToDatabase();
  for (const item of items) {
    await Product.updateOne(
      { _id: item.productId },
      { $inc: { [`stockPerSize.${item.size}`]: item.quantity } },
    );
  }
}
