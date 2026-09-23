import Link from "next/link";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site-config";
import { LogoMark } from "@/components/ui/logo-mark";

type LogoProps = {
  className?: string;
  /** Hide the wordmark and show the mark alone, for tight spaces. */
  markOnly?: boolean;
};

/**
 * Brand lockup: the traced mark plus the wordmark. Both are drawn in
 * currentColor, so placing the lockup inside a `surface-inverse` section
 * flips it to white without a second asset or a colour prop. The mark is
 * sized in em, so overriding the font size scales the whole lockup.
 */
export function Logo({ className, markOnly = false }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label={`${siteConfig.name} — home`}
      className={cn(
        "inline-flex items-center gap-2.5 text-lg",
        "transition-opacity duration-(--duration-quick) ease-out-soft hover:opacity-60",
        className,
      )}
    >
      <LogoMark className="h-[0.78em] w-auto shrink-0" />
      {!markOnly && (
        <span className="type-wide leading-none font-bold tracking-brand uppercase">
          {siteConfig.name}
        </span>
      )}
    </Link>
  );
}
