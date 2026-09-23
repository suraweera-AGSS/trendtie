import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <PlaceholderPage
      step={5}
      title="Cart"
      description="Line items, quantity controls and the live total arrive with the cart and checkout flow in step 5."
    />
  );
}
