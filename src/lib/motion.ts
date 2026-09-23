import type { Variants } from "framer-motion";

/**
 * Shared motion vocabulary. These numbers mirror the CSS tokens in
 * globals.css (--ease-* and --duration-*) so CSS transitions and Framer
 * Motion animations move identically. Change one, change the other.
 *
 * Easings are mutable 4-tuples rather than `as const` readonly arrays,
 * because Framer Motion's Easing type will not accept a readonly array.
 */
type CubicBezier = [number, number, number, number];

export const EASE: Record<"outSoft" | "inOutSoft" | "press", CubicBezier> = {
  outSoft: [0.22, 1, 0.36, 1],
  inOutSoft: [0.65, 0, 0.35, 1],
  press: [0.34, 1.4, 0.64, 1],
};

export const DURATION = {
  instant: 0.12,
  quick: 0.2,
  base: 0.32,
  slow: 0.6,
  slower: 0.9,
} as const;

/** Standard fade-and-rise used by scroll reveals. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE.outSoft },
  },
};

/** Parent variant that staggers its children in sequence. */
export const stagger = (
  staggerChildren = 0.08,
  delayChildren = 0,
): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren, delayChildren },
  },
});
