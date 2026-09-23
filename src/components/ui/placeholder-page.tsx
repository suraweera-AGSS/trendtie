import Link from "next/link";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";

type PlaceholderPageProps = {
  /** Which stage of the build delivers this screen. */
  step: number;
  title: string;
  description: string;
};

/**
 * Honest route stub. The site map is wired up from day one so navigation,
 * typed routes and layout spacing are all real; each screen is then filled
 * in at its scheduled build stage.
 */
export function PlaceholderPage({
  step,
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <Container className="flex min-h-[60vh] flex-col justify-center py-24">
      <p className="eyebrow text-muted">Step {step}</p>
      <h1 className="mt-6 text-hero">{title}</h1>
      <p className="mt-6 max-w-measure text-muted">{description}</p>
      <div className="mt-10">
        <Link href="/" className={buttonClasses("outline", "md")}>
          Back to home
        </Link>
      </div>
    </Container>
  );
}
