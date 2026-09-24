"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { CartProvider } from "@/components/cart/cart-provider";

/**
 * Client providers mounted once at the root. Session sits outside cart so the
 * cart can read who is signed in when checkout needs it.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>{children}</CartProvider>
    </SessionProvider>
  );
}
