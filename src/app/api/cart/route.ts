import { jsonOk, parseJson, route } from "@/lib/api";
import { cartSchema } from "@/lib/validation";
import { priceCart } from "@/lib/cart";

/**
 * POST /api/cart — price a cart against live catalogue data.
 *
 * The cart itself lives in the browser; this endpoint is what makes it
 * trustworthy. It returns server-side prices, the current stock position and
 * a list of any problems, so the cart UI never has to guess and the totals it
 * shows are the totals that will be charged.
 *
 * Returns 200 even when items have problems: an unavailable line is a normal
 * state for a cart to be in, not a failed request. Check `valid` and `issues`.
 */
export const POST = route(async (request: Request) => {
  const { items } = await parseJson(request, cartSchema);
  const cart = await priceCart(items);
  return jsonOk(cart);
});
