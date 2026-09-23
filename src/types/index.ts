import type { Category, Size } from "@/lib/site-config";

/** Stock held per size for a single product. */
export type StockPerSize = Partial<Record<Size, number>>;

export type ProductImage = {
  url: string;
  alt: string;
  /** Cloudinary public id, set once uploads are wired up in the admin panel. */
  publicId?: string;
  width?: number;
  height?: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Price in minor units (cents) to avoid floating point drift. */
  price: number;
  images: ProductImage[];
  sizes: Size[];
  stockPerSize: StockPerSize;
  category: Category;
  featured?: boolean;
  createdAt: string;
};

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  image: ProductImage;
  size: Size;
  quantity: number;
  /** Unit price in minor units at the time the item was added. */
  price: number;
};

export type OrderStatus = "pending" | "shipped" | "delivered" | "cancelled";

export type ShippingAddress = {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
};

export type OrderItem = {
  productId: string;
  name: string;
  size: Size;
  quantity: number;
  price: number;
};

export type Order = {
  id: string;
  userId: string;
  items: OrderItem[];
  status: OrderStatus;
  shippingAddress: ShippingAddress;
  stripePaymentIntentId?: string;
  /** Order total in minor units. */
  total: number;
  createdAt: string;
};

export type UserRole = "customer" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};
