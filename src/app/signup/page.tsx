import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <PlaceholderPage
      step={4}
      title="Create account"
      description="Account creation is wired up with NextAuth in step 4."
    />
  );
}
