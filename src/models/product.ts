import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { CATEGORIES, SIZES } from "@/lib/site-config";

/**
 * Product. Prices are stored in minor units (cents) as integers so that
 * arithmetic on totals never drifts the way floating point money does, and so
 * the value can be handed straight to Stripe in step 5.
 */

const productImageSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, required: true, trim: true },
    /** Cloudinary public id, set once uploads land in step 7. */
    publicId: { type: String, trim: true },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphenated"],
    },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Price must be an integer number of cents",
      },
    },
    images: {
      type: [productImageSchema],
      required: true,
      validate: {
        validator: (images: unknown[]) => images.length > 0,
        message: "A product needs at least one image",
      },
    },
    sizes: {
      type: [{ type: String, enum: SIZES }],
      required: true,
      validate: {
        validator: (sizes: string[]) => sizes.length > 0,
        message: "A product needs at least one size",
      },
    },
    /**
     * Stock held per size, keyed by the size label. A Map keeps the shape the
     * project's TypeScript types already describe while staying queryable:
     * `{ "stockPerSize.M": { $gt: 0 } }` filters to sizes actually in stock.
     */
    stockPerSize: {
      type: Map,
      of: { type: Number, min: 0, default: 0 },
      default: () => new Map<string, number>(),
    },
    category: { type: String, enum: CATEGORIES, required: true },
    featured: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

// Listing and filtering paths from step 3 onwards.
productSchema.index({ category: 1, createdAt: -1 });
productSchema.index({ featured: 1, createdAt: -1 });
productSchema.index({ name: "text", description: "text" });

/** Total units across every size. */
productSchema.virtual("totalStock").get(function () {
  let total = 0;
  for (const quantity of this.stockPerSize?.values() ?? []) total += quantity;
  return total;
});

export type ProductDocument = InferSchemaType<typeof productSchema>;

export const Product: Model<ProductDocument> =
  (models.Product as Model<ProductDocument>) ??
  model<ProductDocument>("Product", productSchema);
