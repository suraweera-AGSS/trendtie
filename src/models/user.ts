import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { ROLES } from "@/lib/permissions";

/**
 * User. Email and password sign-in lands in step 4 via NextAuth, and the
 * shape here is deliberately provider-agnostic so OAuth accounts can be added
 * later without a migration: `passwordHash` is optional, because an account
 * created through Google would never have one.
 *
 * `passwordHash` is `select: false`, so it never leaves the database unless a
 * query explicitly asks for it with `.select("+passwordHash")`. That keeps it
 * out of API responses and server-component props by default.
 */

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
    },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: ROLES,
      default: "customer",
      required: true,
    },
    emailVerifiedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        // Belt and braces: never serialise the hash even if it was selected.
        delete ret.passwordHash;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

userSchema.index({ role: 1, createdAt: -1 });

export type UserDocument = InferSchemaType<typeof userSchema>;

export const User: Model<UserDocument> =
  (models.User as Model<UserDocument>) ?? model<UserDocument>("User", userSchema);
