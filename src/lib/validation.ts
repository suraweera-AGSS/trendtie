import { z } from "zod";
import { CATEGORIES, ORDER_STATUSES, SIZES } from "@/lib/site-config";

/**
 * Input schemas for every route handler. Keeping them together means the
 * client and the API agree on one definition of a valid payload, and the
 * admin forms in step 6 can reuse them for client-side validation.
 */

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Not a valid id");

export const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphenated");

export const sizeSchema = z.enum(SIZES);
export const categorySchema = z.enum(CATEGORIES);
export const orderStatusSchema = z.enum(ORDER_STATUSES);

/** Prices travel as integer minor units, never as decimal strings. */
export const priceSchema = z
  .number()
  .int("Price must be a whole number of cents")
  .min(0)
  .max(100_000_00);

export const productImageSchema = z.object({
  url: z.string().min(1),
  alt: z.string().min(1).max(300),
  publicId: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

// ---- Catalogue queries ----------------------------------------------------

export const productListQuerySchema = z.object({
  category: categorySchema.optional(),
  size: sizeSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  featured: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  /** Only return products with stock left in at least one size. */
  inStock: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort: z.enum(["newest", "oldest", "price-asc", "price-desc", "name"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

// ---- Product writes (admin) ----------------------------------------------

/**
 * Base product shape with no defaults applied.
 *
 * The update schema is derived from this rather than from the create schema
 * on purpose. A `.default()` survives `.partial()`, so an empty PATCH body
 * would parse into `{ featured: false }` and slip past the "at least one
 * field" check — quietly turning a no-op request into a real write.
 */
const productFieldsSchema = z.object({
  name: z.string().trim().min(1).max(140),
  slug: slugSchema.optional(),
  description: z.string().trim().min(1).max(4000),
  price: priceSchema,
  images: z.array(productImageSchema).min(1, "At least one image is required"),
  sizes: z.array(sizeSchema).min(1, "At least one size is required"),
  // zod 4 makes z.record() with an enum key exhaustive, which would demand
  // every size on every request; partialRecord is the partial-map form.
  stockPerSize: z.partialRecord(sizeSchema, z.number().int().min(0)).optional(),
  category: categorySchema,
  featured: z.boolean(),
});

export const productCreateSchema = productFieldsSchema.extend({
  featured: z.boolean().default(false),
});

export const productUpdateSchema = productFieldsSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Provide at least one field to update" },
);

// ---- Auth -----------------------------------------------------------------

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(200, "That password is too long"),
});

export const credentialsSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

// ---- Cart and orders ------------------------------------------------------

export const cartItemSchema = z.object({
  productId: objectIdSchema,
  size: sizeSchema,
  quantity: z.number().int().min(1).max(20),
});

export const cartSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Your cart is empty"),
});

export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().min(1).max(32),
  country: z
    .string()
    .trim()
    .length(2, "Use a two-letter country code")
    .toUpperCase(),
});

export const orderCreateSchema = z.object({
  items: z.array(cartItemSchema).min(1, "An order needs at least one item"),
  shippingAddress: shippingAddressSchema,
});

export const orderStatusUpdateSchema = z.object({
  status: orderStatusSchema,
});

// ---- Admin listing --------------------------------------------------------

export const adminOrderQuerySchema = z.object({
  status: orderStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const adminUserQuerySchema = z.object({
  role: z.enum(["customer", "admin"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
