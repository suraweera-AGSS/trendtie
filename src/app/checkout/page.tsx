import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <PlaceholderPage
      step={5}
      title="Checkout"
      description="Shipping details and Stripe test-mode payment are wired up in step 5."
    />
  );
}
