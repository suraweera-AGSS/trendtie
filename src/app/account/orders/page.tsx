import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <PlaceholderPage
      step={5}
      title="Order history"
      description="Past orders and their status appear here once checkout writes real orders in step 5."
    />
  );
}
