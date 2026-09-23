import { PlaceholderPage } from "@/components/ui/placeholder-page";

type ProductPageProps = {
  // Route params are promises in Next.js 16.
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  return { title: slug.replace(/-/g, " ") };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  return (
    <PlaceholderPage
      step={3}
      title={slug.replace(/-/g, " ")}
      description="The image gallery, size selector, add-to-cart animation and related products are built in step 3."
    />
  );
}
