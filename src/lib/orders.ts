import type { Size } from "@/lib/site-config";

/**
 * One serialiser for orders, shared by the customer endpoints, the admin
 * endpoints and the pages that render them, so an order always looks the same
 * on the wire regardless of which route produced it.
 */

export type OrderItemDTO = {
  productId: string;
  name: string;
  size: Size;
  quantity: number;
  price: number;
  lineTotal: number;
};

export type OrderDTO = {
  id: string;
  userId: string;
  items: OrderItemDTO[];
  status: string;
  shippingAddress: Record<string, string | undefined>;
  total: number;
  currency: string;
  stripePaymentIntentId?: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

type LeanOrder = {
  _id: unknown;
  userId: unknown;
  items?: {
    productId: unknown;
    name: string;
    size: string;
    quantity: number;
    price: number;
  }[];
  status: string;
  shippingAddress?: Record<string, unknown> | null;
  total: number;
  currency?: string;
  stripePaymentIntentId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export function serialiseOrder(doc: LeanOrder): OrderDTO {
  const items = (doc.items ?? []).map((item) => ({
    // populate() replaces productId with a document; keep the id either way.
    productId: String(
      typeof item.productId === "object" && item.productId !== null && "_id" in item.productId
        ? (item.productId as { _id: unknown })._id
        : item.productId,
    ),
    name: item.name,
    size: item.size as Size,
    quantity: item.quantity,
    price: item.price,
    lineTotal: item.price * item.quantity,
  }));

  const address: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(doc.shippingAddress ?? {})) {
    if (typeof value === "string") address[key] = value;
  }

  return {
    id: String(doc._id),
    userId: String(doc.userId),
    items,
    status: doc.status,
    shippingAddress: address,
    total: doc.total,
    currency: doc.currency ?? "USD",
    stripePaymentIntentId: doc.stripePaymentIntentId ?? undefined,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    updatedAt: (doc.updatedAt ?? doc.createdAt ?? new Date()).toISOString(),
  };
}
