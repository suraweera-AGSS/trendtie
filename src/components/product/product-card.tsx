import Image from "next/image";
import Link from "next/link";
import type { ProductDTO } from "@/lib/catalogue";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Image-forward catalogue card. The photograph carries the card; type sits
 * quietly underneath. Hover zooms the image inside a fixed frame rather than
 * moving the card, so the grid never reflows under the cursor.
 */
export function ProductCard({
  product,
  priority = false,
  className,
}: {
  product: ProductDTO;
  /** Set on the first row so the largest contentful paint is not lazy. */
  priority?: boolean;
  className?: string;
}) {
  const image = product.images[0];
  const soldOut = !product.inStock;

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn("group block", className)}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-wash">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
            className={cn(
              "object-cover transition-transform duration-700 ease-out-soft",
              "group-hover:scale-[1.04]",
              soldOut && "opacity-60",
            )}
          />
        ) : null}

        {soldOut && (
          <span className="absolute top-3 left-3 bg-ink px-2.5 py-1.5 text-[0.625rem] font-medium tracking-wide-caps text-paper uppercase">
            Sold out
          </span>
        )}
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="type-wide truncate text-sm font-semibold tracking-tight">
            {product.name}
          </h3>
          <p className="eyebrow mt-1.5 text-muted">{product.category}</p>
        </div>
        <p className="shrink-0 text-sm tabular-nums">
          {formatPrice(product.price)}
        </p>
      </div>
    </Link>
  );
}
