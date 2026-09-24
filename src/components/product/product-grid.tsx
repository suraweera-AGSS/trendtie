import type { ProductDTO } from "@/lib/catalogue";
import { ProductCard } from "@/components/product/product-card";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

/** Responsive catalogue grid: one column on a phone, four on a desktop. */
export function ProductGrid({
  products,
  className,
  columns = 4,
}: {
  products: ProductDTO[];
  className?: string;
  columns?: 3 | 4;
}) {
  return (
    <RevealGroup
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "xl:grid-cols-4",
        className,
      )}
    >
      {products.map((product, index) => (
        <RevealItem key={product.id}>
          <ProductCard product={product} priority={index < 4} />
        </RevealItem>
      ))}
    </RevealGroup>
  );
}
