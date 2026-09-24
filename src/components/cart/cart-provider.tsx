"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Size } from "@/lib/site-config";
import type { PricedCart } from "@/lib/cart";

/**
 * Cart state.
 *
 * The browser holds only what the customer chose — product id, size and
 * quantity. Prices, names, images, stock limits and totals all come back from
 * POST /api/cart, so a stale or edited localStorage entry can never change
 * what something costs. The local list is the request; the server's reply is
 * the truth that gets rendered.
 *
 * localStorage is treated as an external store and read through
 * useSyncExternalStore rather than copied into state inside an effect. That
 * keeps the server and first client render in agreement, and means a change
 * made in one tab shows up in the others through the storage event.
 */

export type CartLine = {
  productId: string;
  size: Size;
  quantity: number;
};

const STORAGE_KEY = "trendtie.cart.v1";

// ---- the store ------------------------------------------------------------

const listeners = new Set<() => void>();

/** Stable empty reference: returning a new [] each read would loop forever. */
const EMPTY: CartLine[] = [];

let cachedRaw: string | null = null;
let cachedLines: CartLine[] = EMPTY;

function parseLines(raw: string | null): CartLine[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const lines = parsed.filter(
      (line): line is CartLine =>
        typeof line === "object" &&
        line !== null &&
        typeof (line as CartLine).productId === "string" &&
        typeof (line as CartLine).size === "string" &&
        Number.isInteger((line as CartLine).quantity) &&
        (line as CartLine).quantity > 0,
    );
    return lines.length ? lines : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): CartLine[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  // Only re-parse when the stored string actually changed, so the snapshot
  // reference stays stable between renders.
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedLines = parseLines(raw);
  }
  return cachedLines;
}

/** The server has no cart, so it always renders the empty one. */
function getServerSnapshot(): CartLine[] {
  return EMPTY;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writeLines(next: CartLine[]) {
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Private mode or quota exceeded: the cart still works for this render
    // pass, it just will not survive a reload.
  }
  cachedRaw = raw;
  cachedLines = next.length ? next : EMPTY;
  for (const listener of listeners) listener();
}

// ---- context --------------------------------------------------------------

type CartContextValue = {
  lines: CartLine[];
  /** Server-priced view of `lines`, null until the first response arrives. */
  priced: PricedCart | null;
  loading: boolean;
  count: number;
  subtotal: number;
  add: (line: CartLine) => void;
  setQuantity: (productId: string, size: Size, quantity: number) => void;
  remove: (productId: string, size: Size) => void;
  clear: () => void;
  /** Key of the line most recently added, for the add-to-cart confirmation. */
  justAdded: string | null;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [pricedState, setPricedState] = useState<{
    key: string;
    cart: PricedCart;
  } | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  // Identity of the current cart contents, used both as the fetch key and to
  // tell whether the pricing on screen is still current.
  const linesKey = JSON.stringify(lines);

  useEffect(() => {
    if (!lines.length) return;

    const controller = new AbortController();

    // Every setState below runs in a promise continuation, never synchronously
    // in the effect body, so this cannot cascade renders.
    fetch("/api/cart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: lines }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((cart: PricedCart | null) => {
        if (cart) setPricedState({ key: linesKey, cart });
      })
      .catch(() => {
        // Aborted or offline: keep showing the last good pricing.
      });

    return () => controller.abort();
  }, [linesKey, lines]);

  // Derived rather than stored, so there is no loading flag to keep in sync.
  const priced = lines.length ? (pricedState?.cart ?? null) : null;
  const stale = lines.length > 0 && pricedState?.key !== linesKey;

  const add = useCallback((line: CartLine) => {
    const current = getSnapshot();
    const index = current.findIndex(
      (l) => l.productId === line.productId && l.size === line.size,
    );

    if (index === -1) {
      writeLines([...current, line]);
    } else {
      const next = [...current];
      next[index] = {
        ...next[index],
        quantity: next[index].quantity + line.quantity,
      };
      writeLines(next);
    }

    const key = `${line.productId}:${line.size}`;
    setJustAdded(key);
    window.setTimeout(() => setJustAdded((k) => (k === key ? null : k)), 1800);
  }, []);

  const setQuantity = useCallback(
    (productId: string, size: Size, quantity: number) => {
      const current = getSnapshot();
      writeLines(
        quantity <= 0
          ? current.filter((l) => !(l.productId === productId && l.size === size))
          : current.map((l) =>
              l.productId === productId && l.size === size
                ? { ...l, quantity }
                : l,
            ),
      );
    },
    [],
  );

  const remove = useCallback((productId: string, size: Size) => {
    writeLines(
      getSnapshot().filter(
        (l) => !(l.productId === productId && l.size === size),
      ),
    );
  }, []);

  const clear = useCallback(() => writeLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      priced,
      loading: stale,
      // Prefer the server count once it is current; fall back to the local
      // tally so the header badge never shows a stale zero.
      count: stale
        ? lines.reduce((sum, line) => sum + line.quantity, 0)
        : (priced?.itemCount ??
          lines.reduce((sum, line) => sum + line.quantity, 0)),
      subtotal: priced?.subtotal ?? 0,
      add,
      setQuantity,
      remove,
      clear,
      justAdded,
    }),
    [lines, priced, stale, add, setQuantity, remove, clear, justAdded],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside a CartProvider");
  return context;
}
