/**
 * Importing this module registers every schema on the mongoose instance.
 * Anything that calls `.populate()` needs the referenced model registered, so
 * route handlers and scripts import from here rather than reaching for a
 * single model file.
 */
export { Product, type ProductDocument } from "@/models/product";
export { Order, type OrderDocument } from "@/models/order";
export { User, type UserDocument } from "@/models/user";
