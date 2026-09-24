import type { Metadata } from "next";
import { ProductManager } from "@/components/admin/product-manager";
import { listProducts } from "@/lib/catalogue";

export const metadata: Metadata = {
  title: "Products",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const result = await listProducts({ sort: "newest", page: 1, limit: 60 });

  return (
    <div className="px-6 py-10 lg:px-10 lg:py-12">
      <ProductManager products={result.items} />
    </div>
  );
}
