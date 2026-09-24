import { Container } from "@/components/ui/container";

/**
 * Route-agnostic loading state. This boundary covers every segment that does
 * not define its own, so it stays neutral rather than miming a product grid
 * that would be wrong on the account and auth screens. Per-route skeletons
 * land with their pages.
 */
export default function Loading() {
  return (
    <Container className="py-24">
      <span className="sr-only">Loading</span>
      <div aria-hidden className="flex flex-col gap-4">
        <div className="h-px w-full animate-fade-in bg-line" />
        <div className="h-3 w-24 animate-pulse bg-wash" />
        <div className="h-10 w-2/3 animate-pulse bg-wash sm:h-14" />
        <div className="h-4 w-full max-w-measure animate-pulse bg-wash" />
        <div className="h-4 w-5/6 max-w-measure animate-pulse bg-wash" />
      </div>
    </Container>
  );
}
