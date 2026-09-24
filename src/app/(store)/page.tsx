import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";
import { ProductGrid } from "@/components/product/product-grid";
import { Reveal } from "@/components/motion/reveal";
import { getFeaturedProducts, listProducts } from "@/lib/catalogue";
import { siteConfig } from "@/lib/site-config";

// The catalogue changes when the admin edits it, so the homepage is rendered
// per request rather than baked at build time.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, latest] = await Promise.all([
    getFeaturedProducts(3),
    listProducts({ sort: "newest", page: 1, limit: 8 }),
  ]);

  // The hero is the largest photograph on the site, so prefer a product with
  // real photography over one still on a generated placeholder. Once every
  // product has been shot this simply picks the first featured item.
  const candidates = [...featured, ...latest.items];
  const hero =
    candidates.find(
      (product) => !product.images[0]?.url.includes("placeholder"),
    ) ?? candidates[0];

  return (
    <>
      {/* Hero: brand statement carried by type, with one large photograph. */}
      <section className="border-b border-line">
        <Container className="grid items-center gap-12 py-20 lg:grid-cols-2 lg:gap-16 lg:py-32">
          <div>
            <p className="eyebrow text-muted">Monochrome merchandise</p>
            <h1 className="mt-6 text-display">Black and white. Nothing else.</h1>
            <p className="mt-8 max-w-measure text-base text-muted sm:text-lg">
              {siteConfig.description}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/products" className={buttonClasses("solid", "lg")}>
                Shop all
              </Link>
              {hero ? (
                <Link
                  href={`/products/${hero.slug}`}
                  className={buttonClasses("outline", "lg")}
                >
                  {hero.name.split("—")[0].trim()}
                </Link>
              ) : null}
            </div>
          </div>

          {hero?.images[0] ? (
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-wash lg:aspect-square">
              <Image
                src={hero.images[0].url}
                alt={hero.images[0].alt}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : null}
        </Container>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="border-b border-line">
          <Container className="py-20 lg:py-28">
            <Reveal className="flex items-end justify-between gap-6">
              <div>
                <p className="eyebrow text-muted">Featured</p>
                <h2 className="mt-4 text-title">The ones we keep restocking</h2>
              </div>
              <Link
                href="/products"
                className="underline-draw type-wide hidden text-xs font-medium tracking-wide-caps uppercase sm:inline-block"
              >
                View all
              </Link>
            </Reveal>

            <ProductGrid products={featured} columns={3} className="mt-14" />
          </Container>
        </section>
      )}

      {/* Brand statement on an inverted surface */}
      <section className="surface-inverse">
        <Container className="py-24 text-center lg:py-36">
          <Reveal>
            <p className="eyebrow text-muted-inverse">Why two colours</p>
            <p className="mx-auto mt-8 max-w-4xl text-hero">
              A colour chart is a way of avoiding a decision. We made ours once.
            </p>
            <p className="mx-auto mt-8 max-w-measure text-muted-inverse">
              Every piece is cut in heavyweight cotton and printed in one of two
              colours. Nothing seasonal, nothing that dates, nothing you have to
              think about at seven in the morning.
            </p>
          </Reveal>
        </Container>
      </section>

      {/* Latest */}
      <section>
        <Container className="py-20 lg:py-28">
          <Reveal>
            <p className="eyebrow text-muted">New arrivals</p>
            <h2 className="mt-4 text-title">Everything in stock</h2>
          </Reveal>
          <ProductGrid products={latest.items} className="mt-14" />

          <Reveal className="mt-16 flex justify-center">
            <Link href="/products" className={buttonClasses("outline", "lg")}>
              Shop all {latest.total} products
            </Link>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
