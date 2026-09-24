"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-provider";
import { formatPrice } from "@/lib/utils";
import { DURATION, EASE } from "@/lib/motion";

/**
 * Cart page.
 *
 * Every figure shown comes from the server's pricing response, so what the
 * customer reads here is what checkout will charge. Lines with a problem stay
 * in place with an explanation instead of vanishing, which is what makes the
 * "sold out while you were deciding" case understandable rather than eerie.
 */
export function CartView() {
  const { lines, priced, loading, setQuantity, remove, clear } = useCart();
  const reduced = useReducedMotion();

  if (lines.length === 0) {
    return (
      <Container className="flex min-h-[60vh] flex-col justify-center py-24">
        <p className="eyebrow text-muted">Cart</p>
        <h1 className="mt-6 text-hero">Nothing in here yet.</h1>
        <p className="mt-6 max-w-measure text-muted">
          Once you add something it will stay in your cart on this device,
          even if you close the tab.
        </p>
        <div className="mt-10">
          <Link href="/products" className={buttonClasses("solid", "md")}>
            Shop all
          </Link>
        </div>
      </Container>
    );
  }

  const items = priced?.items ?? [];
  const issues = priced?.issues ?? [];

  return (
    <Container className="py-16 lg:py-24">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow text-muted">Cart</p>
          <h1 className="mt-5 text-hero">Your bag</h1>
        </div>
        <button
          type="button"
          onClick={clear}
          className="underline-draw type-wide cursor-pointer text-xs tracking-wide-caps text-muted uppercase"
        >
          Clear cart
        </button>
      </header>

      {issues.length > 0 && (
        <div
          role="status"
          className="mt-10 border border-ink p-5"
        >
          <p className="eyebrow">Needs attention</p>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {issues.map((issue) => (
              <li key={`${issue.productId}:${issue.size}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-12 grid gap-16 lg:grid-cols-[1.6fr_1fr]">
        {/* Lines */}
        <ul className="border-t border-line">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.li
                key={`${item.productId}:${item.size}`}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduced ? undefined : { opacity: 0, height: 0 }}
                transition={{ duration: DURATION.base, ease: EASE.outSoft }}
                className="overflow-hidden border-b border-line"
              >
                <div className="flex gap-5 py-6">
                  <Link
                    href={`/products/${item.slug}`}
                    className="relative aspect-square w-24 shrink-0 overflow-hidden bg-wash sm:w-32"
                  >
                    {item.image && (
                      <Image
                        src={item.image.url}
                        alt={item.image.alt}
                        fill
                        sizes="128px"
                        className="object-cover"
                      />
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/products/${item.slug}`}
                          className="underline-draw type-wide text-sm font-semibold"
                        >
                          {item.name}
                        </Link>
                        <p className="eyebrow mt-2 text-muted">
                          Size {item.size === "ONE_SIZE" ? "one size" : item.size}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm tabular-nums">
                        {formatPrice(item.lineTotal)}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="flex items-center border border-line">
                        <QuantityButton
                          label="Decrease quantity"
                          onClick={() =>
                            setQuantity(item.productId, item.size, item.quantity - 1)
                          }
                        >
                          &minus;
                        </QuantityButton>
                        <span className="w-10 text-center text-sm tabular-nums">
                          {item.quantity}
                        </span>
                        <QuantityButton
                          label="Increase quantity"
                          disabled={item.quantity >= item.available}
                          onClick={() =>
                            setQuantity(item.productId, item.size, item.quantity + 1)
                          }
                        >
                          +
                        </QuantityButton>
                      </div>

                      <button
                        type="button"
                        onClick={() => remove(item.productId, item.size)}
                        className="underline-draw type-wide cursor-pointer text-[0.6875rem] tracking-wide-caps text-muted uppercase"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {/* Summary */}
        <aside className="lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:self-start">
          <div className="border border-line p-7">
            <h2 className="eyebrow text-muted">Summary</h2>

            <dl className="mt-6 flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">
                  Subtotal{priced ? ` (${priced.itemCount} items)` : ""}
                </dt>
                <dd className="tabular-nums">
                  {loading && !priced ? "…" : formatPrice(priced?.subtotal ?? 0)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="text-muted">Calculated at checkout</dd>
              </div>
            </dl>

            <div className="mt-6 flex justify-between border-t border-line pt-5">
              <span className="type-wide text-sm font-semibold">Total</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatPrice(priced?.subtotal ?? 0)}
              </span>
            </div>

            <Link
              href="/checkout"
              aria-disabled={!priced?.valid}
              tabIndex={priced?.valid ? undefined : -1}
              className={buttonClasses(
                "solid",
                "lg",
                `mt-7 w-full ${priced?.valid ? "" : "pointer-events-none opacity-40"}`,
              )}
            >
              Checkout
            </Link>

            {!priced?.valid && (
              <p className="mt-4 text-xs text-muted">
                Resolve the items above to continue.
              </p>
            )}

            <Link
              href="/products"
              className="underline-draw type-wide mt-6 block text-center text-[0.6875rem] tracking-wide-caps text-muted uppercase"
            >
              Continue shopping
            </Link>
          </div>
        </aside>
      </div>
    </Container>
  );
}

function QuantityButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-10 cursor-pointer items-center justify-center text-sm transition-[background-color,color] duration-(--duration-quick) ease-out-soft hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
    >
      {children}
    </button>
  );
}
