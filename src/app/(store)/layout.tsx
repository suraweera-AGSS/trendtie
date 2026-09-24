import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

/**
 * Storefront chrome.
 *
 * This lives in a route group rather than the root layout so that the admin
 * panel, which has its own sidebar and identity, does not inherit the shop
 * header and footer. Route groups do not appear in the URL, so every page
 * underneath keeps the path it had.
 */
export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
