"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  /** Next 16 passes `retry`, which re-fetches and re-renders the segment.
      `reset` only clears error state without re-fetching. */
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="flex min-h-[60vh] flex-col justify-center py-24">
      <p className="eyebrow text-muted">Error</p>
      <h1 className="mt-6 text-hero">Something went wrong.</h1>
      <p className="mt-6 max-w-measure text-muted">
        The page failed to load. Try again, and if it keeps happening let us
        know.
      </p>
      <div className="mt-10">
        <Button onClick={() => retry()} size="md">
          Try again
        </Button>
      </div>
    </Container>
  );
}
