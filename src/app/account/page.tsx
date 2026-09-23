import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <PlaceholderPage
      step={4}
      title="Account"
      description="Profile details land with authentication in step 4; order history follows in step 5."
    />
  );
}
