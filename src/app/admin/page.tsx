import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <PlaceholderPage
      step={6}
      title="Admin"
      description="Dashboard stats, product CRUD and order management are built in step 6, behind an admin-only route guard."
    />
  );
}
