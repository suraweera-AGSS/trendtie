import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductFilters } from "@/components/product/product-filters";
import { listProducts } from "@/lib/catalogue";
import { productListQuerySchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Shop all" };
export const dynamic = "force-dynamic";

type PageProps = {
  // searchParams is a promise in Next 16.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsPage({ searchParams }: PageProps) {
  const raw = await searchParams;

  // Flatten repeated params and drop anything invalid, so a hand-edited URL
  // degrades to the default listing instead of throwing.
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
    else if (Array.isArray(value) && value[0]) flat[key] = value[0];
  }

  const parsed = productListQuerySchema.safeParse(flat);
  const query = parsed.success
    ? parsed.data
    : productListQuerySchema.parse({});

  const result = await listProducts(query);

  return (
    <Container className="py-16 lg:py-24">
      <header>
        <p className="eyebrow text-muted">Catalogue</p>
        <h1 className="mt-5 text-hero">Shop all</h1>
      </header>

      <div className="mt-12">
        <Suspense fallback={<div className="h-40 border-b border-line" />}>
          <ProductFilters total={result.total} />
        </Suspense>
      </div>

      {result.items.length > 0 ? (
        <>
          <ProductGrid products={result.items} className="mt-14" />

          {result.pages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-20 flex items-center justify-center gap-3"
            >
              {Array.from({ length: result.pages }, (_, i) => i + 1).map((page) => {
                const params = new URLSearchParams(flat);
                params.set("page", String(page));
                return (
                  <Link
                    key={page}
                    href={`/products?${params.toString()}`}
                    aria-current={page === result.page ? "page" : undefined}
                    className={
                      page === result.page
                        ? "type-wide border border-ink bg-ink px-4 py-2 text-xs text-paper tabular-nums"
                        : "type-wide border border-line px-4 py-2 text-xs tabular-nums hover:border-ink"
                    }
                  >
                    {page}
                  </Link>
                );
              })}
            </nav>
          )}
        </>
      ) : (
        <div className="mt-24 flex flex-col items-center py-16 text-center">
          <p className="eyebrow text-muted">No matches</p>
          <h2 className="mt-5 text-title">Nothing fits those filters.</h2>
          <p className="mt-4 max-w-measure text-muted">
            Try widening the size or category, or clear the filters to see the
            whole catalogue.
          </p>
          <Link href="/products" className={buttonClasses("outline", "md", "mt-10")}>
            Clear filters
          </Link>
        </div>
      )}
    </Container>
  );
}
