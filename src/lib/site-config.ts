import type { Route } from "next";

/**
 * Single source of truth for brand copy, navigation and metadata.
 * Swap the wordmark for the supplied logo asset in components/ui/logo.tsx.
 */
export const siteConfig = {
  name: "TRENDTIE",
  tagline: "Black and white. Nothing else.",
  description:
    "Monochrome merchandise built for people who do not need a colour chart. Tees, hoodies and caps in pure black and pure white.",
  currency: "USD",
} as const;

export type NavLink = {
  label: string;
  /** Typed route literal, validated against the App Router at build time. */
  href: Route;
};

export const primaryNav: NavLink[] = [
  { label: "Shop all", href: "/products" },
  { label: "Tees", href: "/products?category=tees" },
  { label: "Hoodies", href: "/products?category=hoodies" },
  { label: "Caps", href: "/products?category=caps" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Shop",
    links: [
      { label: "All products", href: "/products" },
      { label: "New arrivals", href: "/products?sort=newest" },
      { label: "Best sellers", href: "/products?sort=popular" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Create account", href: "/signup" },
      { label: "Order history", href: "/account/orders" },
    ],
  },
];

/** Sizes offered across apparel. Caps use ONE_SIZE. */
export const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "ONE_SIZE"] as const;
export type Size = (typeof SIZES)[number];

export const CATEGORIES = ["tees", "hoodies", "caps", "accessories"] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Order lifecycle. Declared here rather than in the Mongoose model so that
 * client components can import it without dragging the database driver into
 * the browser bundle.
 */
export const ORDER_STATUSES = [
  "pending",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
