import Link from "next/link";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col justify-center py-24">
      <p className="eyebrow text-muted">404</p>
      <h1 className="mt-6 text-hero">This page does not exist.</h1>
      <p className="mt-6 max-w-measure text-muted">
        The link may be broken, or the product may have sold out and been
        retired.
      </p>
      <div className="mt-10">
        <Link href="/" className={buttonClasses("solid", "md")}>
          Back to home
        </Link>
      </div>
    </Container>
  );
}
