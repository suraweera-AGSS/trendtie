import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";
import Link from "next/link";

/**
 * Placeholder home page. The real hero, featured grid and scroll-triggered
 * animations land in step 3, once the look is signed off.
 */
export default function HomePage() {
  return (
    <Container className="flex min-h-[70vh] flex-col justify-center py-24">
      <p className="eyebrow text-muted">Step 1 — scaffold complete</p>
      <h1 className="mt-6 max-w-4xl text-display">Black and white. Nothing else.</h1>
      <p className="mt-8 max-w-measure text-base text-muted sm:text-lg">
        Design tokens, base layout and folder structure are in place. The
        homepage, product listing and product detail pages come next.
      </p>
      <div className="mt-12 flex flex-wrap gap-4">
        <Link href="/products" className={buttonClasses("solid", "lg")}>
          Shop all
        </Link>
        <Link href="/account" className={buttonClasses("outline", "lg")}>
          Account
        </Link>
      </div>
    </Container>
  );
}
