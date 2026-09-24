import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { ProductGrid } from "@/components/product/product-grid";
import { AddToCart } from "@/components/product/add-to-cart";
import { Reveal } from "@/components/motion/reveal";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalogue";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  // Route params are promises in Next.js 16.
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Not found" };

  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product, 4);

  return (
    <>
      <Container className="py-10 lg:py-16">
        <nav aria-label="Breadcrumb" className="eyebrow text-muted">
          <Link href="/products" className="underline-draw">
            Shop
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/products?category=${product.category}`}
            className="underline-draw"
          >
            {product.category}
          </Link>
        </nav>

        <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Gallery */}
          <div className="flex flex-col gap-4">
            {product.images.map((image, index) => (
              <div
                key={image.url + index}
                className="relative aspect-square w-full overflow-hidden bg-wash"
              >
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  priority={index === 0}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>

          {/* Detail. Sticky on desktop so the buy controls stay reachable
              while a tall gallery scrolls past. */}
          <div className="lg:sticky lg:top-(--header-height) lg:self-start lg:pt-4">
            <p className="eyebrow text-muted">{product.category}</p>
            <h1 className="mt-5 text-hero">{product.name}</h1>
            <p className="mt-6 text-lg tabular-nums">
              {formatPrice(product.price)}
            </p>

            <p className="mt-8 max-w-measure text-muted">{product.description}</p>

            <AddToCart product={product} />

            <dl className="mt-12 border-t border-line pt-8 text-sm">
              <div className="flex justify-between border-b border-line py-3">
                <dt className="text-muted">Availability</dt>
                <dd className="tabular-nums">
                  {product.inStock
                    ? `${product.totalStock} in stock`
                    : "Sold out"}
                </dd>
              </div>
              <div className="flex justify-between border-b border-line py-3">
                <dt className="text-muted">Sizes</dt>
                <dd>
                  {product.sizes
                    .map((s) => (s === "ONE_SIZE" ? "One size" : s))
                    .join(", ")}
                </dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-muted">Colourway</dt>
                <dd>Black and white only</dd>
              </div>
            </dl>
          </div>
        </div>
      </Container>

      {related.length > 0 && (
        <section className="border-t border-line">
          <Container className="py-20 lg:py-28">
            <Reveal>
              <p className="eyebrow text-muted">You might also like</p>
              <h2 className="mt-4 text-title">Related pieces</h2>
            </Reveal>
            <ProductGrid products={related} className="mt-14" />
          </Container>
        </section>
      )}
    </>
  );
}
