"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/ui/container";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useCart } from "@/components/cart/cart-provider";
import { formatPrice } from "@/lib/utils";

/**
 * Checkout.
 *
 * Creates the order server-side first, then attempts payment. That order is
 * the record of intent; if Stripe is not configured the order still exists as
 * pending and the admin can see it, which is what makes the store usable
 * before payment keys are added.
 */
export function CheckoutForm() {
  const router = useRouter();
  const { status } = useSession();
  const { lines, priced, clear } = useCart();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  if (status === "loading") {
    return (
      <Container className="py-24">
        <p className="eyebrow text-muted">Loading</p>
      </Container>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Container className="flex min-h-[60vh] flex-col justify-center py-24">
        <p className="eyebrow text-muted">Checkout</p>
        <h1 className="mt-6 text-hero">Sign in to continue.</h1>
        <p className="mt-6 max-w-measure text-muted">
          Your cart is saved on this device. Signing in lets us attach the order
          to your account so you can track it afterwards.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/login?callbackUrl=/checkout"
            className={buttonClasses("solid", "md")}
          >
            Sign in
          </Link>
          <Link href="/signup" className={buttonClasses("outline", "md")}>
            Create account
          </Link>
        </div>
      </Container>
    );
  }

  if (!lines.length) {
    return (
      <Container className="flex min-h-[60vh] flex-col justify-center py-24">
        <p className="eyebrow text-muted">Checkout</p>
        <h1 className="mt-6 text-hero">Your cart is empty.</h1>
        <div className="mt-10">
          <Link href="/products" className={buttonClasses("solid", "md")}>
            Shop all
          </Link>
        </div>
      </Container>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const shippingAddress = {
      fullName: String(form.get("fullName") ?? ""),
      line1: String(form.get("line1") ?? ""),
      line2: String(form.get("line2") ?? "") || undefined,
      city: String(form.get("city") ?? ""),
      state: String(form.get("state") ?? "") || undefined,
      postalCode: String(form.get("postalCode") ?? ""),
      country: String(form.get("country") ?? "").toUpperCase(),
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: lines, shippingAddress }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(body?.error?.message ?? "Could not place the order.");
        setFieldErrors(body?.error?.details ?? {});
        setSubmitting(false);
        return;
      }

      const orderId = body.order.id;

      // Try to start payment. A store without Stripe keys still completes the
      // order; the confirmation page explains what happens next.
      let paid = false;
      try {
        const checkout = await fetch("/api/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        paid = checkout.ok;
      } catch {
        paid = false;
      }

      clear();
      router.push(`/checkout/confirmation?order=${orderId}&paid=${paid}`);
    } catch {
      setError("Could not reach the server. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <Container className="py-16 lg:py-24">
      <p className="eyebrow text-muted">Checkout</p>
      <h1 className="mt-5 text-hero">Shipping details</h1>

      <form
        onSubmit={handleSubmit}
        className="mt-12 grid gap-16 lg:grid-cols-[1.4fr_1fr]"
      >
        <div className="flex flex-col gap-6">
          {error && (
            <p role="alert" className="border border-ink p-4 text-sm">
              {error}
            </p>
          )}

          <Field
            label="Full name"
            name="fullName"
            required
            autoComplete="name"
            error={fieldErrors.fullName?.[0]}
          />
          <Field
            label="Address line 1"
            name="line1"
            required
            autoComplete="address-line1"
            error={fieldErrors.line1?.[0]}
          />
          <Field
            label="Address line 2"
            name="line2"
            autoComplete="address-line2"
            error={fieldErrors.line2?.[0]}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="City"
              name="city"
              required
              autoComplete="address-level2"
              error={fieldErrors.city?.[0]}
            />
            <Field
              label="State or region"
              name="state"
              autoComplete="address-level1"
              error={fieldErrors.state?.[0]}
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Postal code"
              name="postalCode"
              required
              autoComplete="postal-code"
              error={fieldErrors.postalCode?.[0]}
            />
            <Field
              label="Country code"
              name="country"
              required
              defaultValue="LK"
              maxLength={2}
              hint="Two letters, for example LK or GB"
              autoComplete="country"
              error={fieldErrors.country?.[0]}
            />
          </div>
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:self-start">
          <div className="border border-line p-7">
            <h2 className="eyebrow text-muted">Order summary</h2>

            <ul className="mt-6 flex flex-col gap-4">
              {(priced?.items ?? []).map((item) => (
                <li
                  key={`${item.productId}:${item.size}`}
                  className="flex justify-between gap-4 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{item.name}</span>
                    <span className="eyebrow mt-1 block text-muted">
                      {item.size === "ONE_SIZE" ? "One size" : item.size} ×{" "}
                      {item.quantity}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatPrice(item.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex justify-between border-t border-line pt-5">
              <span className="type-wide text-sm font-semibold">Total</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatPrice(priced?.subtotal ?? 0)}
              </span>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={submitting || !priced?.valid}
              className="mt-7 w-full"
            >
              {submitting ? "Placing order…" : "Place order"}
            </Button>

            <p className="mt-4 text-xs text-muted">
              Prices are confirmed against the catalogue when the order is
              placed.
            </p>
          </div>
        </aside>
      </form>
    </Container>
  );
}
