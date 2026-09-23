import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export const metadata: Metadata = { title: "Shop all" };

export default function ProductsPage() {
  return (
    <PlaceholderPage
      step={3}
      title="Shop all"
      description="The product grid, category and size filters and sort controls are built on sample data in step 3."
    />
  );
}
