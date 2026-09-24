import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { ORDER_STATUSES, SIZES } from "@/lib/site-config";

/**
 * Order. Line items copy the product name and unit price at purchase time
 * rather than only referencing the product, so that later edits to a product
 * (a price change, a rename, a deletion) never rewrite history on an order
 * that has already been paid for.
 */

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    /** Name as it was at purchase time. */
    name: { type: String, required: true, trim: true },
    size: { type: String, enum: SIZES, required: true },
    quantity: { type: Number, required: true, min: 1 },
    /** Unit price in minor units at purchase time. */
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Price must be an integer number of cents",
      },
    },
  },
  { _id: false },
);

const shippingAddressSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, minlength: 2 },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) => items.length > 0,
        message: "An order needs at least one item",
      },
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "pending",
      required: true,
    },
    shippingAddress: { type: shippingAddressSchema, required: true },
    /**
     * Unique but sparse: orders exist before payment is attempted, so many
     * documents legitimately have no intent id, and only one order may ever
     * claim a given Stripe intent.
     */
    stripePaymentIntentId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    /** Order total in minor units, stored so the figure is auditable. */
    total: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Total must be an integer number of cents",
      },
    },
    currency: { type: String, required: true, default: "USD", uppercase: true },
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

// Account order history, and the admin order queue.
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });

/** Sum of the line items, for checking the stored total adds up. */
orderSchema.virtual("computedTotal").get(function () {
  return this.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
});

export type OrderDocument = InferSchemaType<typeof orderSchema>;

export const Order: Model<OrderDocument> =
  (models.Order as Model<OrderDocument>) ??
  model<OrderDocument>("Order", orderSchema);
