import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { footerNav, siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="surface-inverse mt-auto">
      <Container className="grid gap-12 py-16 md:grid-cols-[1.5fr_2fr] md:py-24">
        <div className="flex flex-col gap-4">
          <Logo className="text-xl" />
          <p className="max-w-xs text-sm text-muted-inverse">
            {siteConfig.tagline}
          </p>
        </div>

        <div className="grid gap-10 sm:grid-cols-2">
          {footerNav.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="eyebrow text-muted-inverse">{group.title}</h2>
              <ul className="mt-5 flex flex-col gap-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="underline-draw text-sm text-paper/90 hover:text-paper"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </Container>

      <div className="border-t border-line-inverse">
        <Container className="flex flex-col gap-3 py-6 text-xs text-muted-inverse sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {siteConfig.name}. All rights reserved.
          </p>
          <p className="tracking-wide-caps uppercase">Black and white only</p>
        </Container>
      </div>
    </footer>
  );
}
