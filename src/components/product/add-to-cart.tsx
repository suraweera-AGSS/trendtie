"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { ProductDTO } from "@/lib/catalogue";
import type { Size } from "@/lib/site-config";
import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";
import { DURATION, EASE } from "@/lib/motion";

/**
 * Size selector and add-to-cart.
 *
 * Sold-out sizes stay visible but disabled rather than disappearing, so the
 * size ladder does not shift between products and the customer can see that
 * their size exists and is simply gone.
 */
export function AddToCart({ product }: { product: ProductDTO }) {
  const { add, justAdded } = useCart();
  const reduced = useReducedMotion();

  const onlyOneSize = product.sizes.length === 1;
  const [size, setSize] = useState<Size | null>(
    onlyOneSize ? product.sizes[0] : null,
  );
  const [error, setError] = useState<string | null>(null);

  const stockFor = (value: Size) => product.stockPerSize[value] ?? 0;
  const selectedStock = size ? stockFor(size) : 0;
  const added = size ? justAdded === `${product.id}:${size}` : false;

  function handleAdd() {
    if (!size) {
      setError("Choose a size first.");
      return;
    }
    if (stockFor(size) <= 0) {
      setError("That size is sold out.");
      return;
    }
    setError(null);
    add({ productId: product.id, size, quantity: 1 });
  }

  return (
    <div className="mt-10">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow text-muted">
          {onlyOneSize ? "One size" : "Size"}
        </span>
        {size && selectedStock > 0 && selectedStock <= 5 && (
          <span className="text-xs text-muted tabular-nums">
            Only {selectedStock} left
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {product.sizes.map((value) => {
          const stock = stockFor(value);
          const soldOut = stock <= 0;
          const selected = size === value;

          return (
            <button
              key={value}
              type="button"
              disabled={soldOut}
              aria-pressed={selected}
              onClick={() => {
                setSize(value);
                setError(null);
              }}
              className={cn(
                "type-wide relative min-w-14 border px-4 py-3 text-xs tracking-wide-caps uppercase",
                "transition-[background-color,color,border-color] duration-(--duration-quick) ease-out-soft",
                selected && "border-ink bg-ink text-paper",
                !selected && !soldOut && "border-line hover:border-ink cursor-pointer",
                soldOut &&
                  "cursor-not-allowed border-line text-subtle line-through",
              )}
            >
              {value === "ONE_SIZE" ? "One size" : value}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-xs text-ink">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center gap-4">
        <Button
          size="lg"
          onClick={handleAdd}
          disabled={!product.inStock}
          className="relative min-w-56 overflow-hidden"
        >
          {/* The label swaps for a confirmation, then swaps back. Movement is
              vertical and short, so it reads as a state change rather than a
              celebration. */}
          <AnimatePresence initial={false} mode="wait">
            {added ? (
              <motion.span
                key="added"
                initial={reduced ? false : { y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduced ? undefined : { y: -14, opacity: 0 }}
                transition={{ duration: DURATION.quick, ease: EASE.outSoft }}
              >
                Added to cart
              </motion.span>
            ) : (
              <motion.span
                key="add"
                initial={reduced ? false : { y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduced ? undefined : { y: -14, opacity: 0 }}
                transition={{ duration: DURATION.quick, ease: EASE.outSoft }}
              >
                {product.inStock ? "Add to cart" : "Sold out"}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>

        <span className="text-sm tabular-nums">{formatPrice(product.price)}</span>
      </div>
    </div>
  );
}
