"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/logo";
import { Container } from "@/components/ui/container";
import { primaryNav } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import { useCart } from "@/components/cart/cart-provider";

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const { count } = useCart();

  // Close the mobile panel whenever the route changes. Adjusting state during
  // render is React's recommended reset pattern and avoids the extra commit a
  // useEffect would cost.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  // Lock background scroll and allow Escape to dismiss while the panel is open.
  useEffect(() => {
    if (!menuOpen) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-md">
      <Container className="flex h-(--header-height) items-center justify-between gap-6">
        <Logo />

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {primaryNav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="type-wide underline-draw text-xs font-medium tracking-wide-caps uppercase"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-5">
          <Link
            href="/account"
            className="type-wide hidden text-xs font-medium tracking-wide-caps uppercase underline-draw sm:inline-flex"
          >
            Account
          </Link>
          <Link
            href="/cart"
            className="type-wide text-xs font-medium tracking-wide-caps uppercase underline-draw"
          >
            Cart ({count})
          </Link>

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
            className="relative flex h-8 w-8 cursor-pointer flex-col items-center justify-center gap-1.5 md:hidden"
          >
            <span
              className={cn(
                "block h-px w-5 bg-ink transition-[translate,rotate] duration-(--duration-base) ease-out-soft",
                menuOpen && "translate-y-[3.5px] rotate-45",
              )}
            />
            <span
              className={cn(
                "block h-px w-5 bg-ink transition-[translate,rotate] duration-(--duration-base) ease-out-soft",
                menuOpen && "-translate-y-[3.5px] -rotate-45",
              )}
            />
          </button>
        </div>
      </Container>

      <div
        id="mobile-menu"
        inert={!menuOpen}
        className={cn(
          "absolute inset-x-0 top-full border-b border-line bg-paper md:hidden",
          "transition-[opacity,translate] duration-(--duration-base) ease-out-soft",
          menuOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        {/* Closing on click as well as on pathname change: most nav links
            differ only by query string, which usePathname does not see. */}
        <Container className="flex flex-col py-6">
          {primaryNav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="type-wide border-b border-line py-4 text-2xl font-semibold tracking-brand"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/account"
            onClick={() => setMenuOpen(false)}
            className="type-wide py-4 text-2xl font-semibold tracking-brand"
          >
            Account
          </Link>
        </Container>
      </div>
    </header>
  );
}
