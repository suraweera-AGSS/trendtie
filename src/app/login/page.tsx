import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <PlaceholderPage
      step={4}
      title="Sign in"
      description="Email and password sign-in through NextAuth, structured so OAuth providers can be added later."
    />
  );
}
