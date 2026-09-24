"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";
import {
  ROLE_LABELS,
  can,
  type Permission,
  type Role,
} from "@/lib/permissions";

type NavItem = {
  href: string;
  label: string;
  /** Hidden entirely when the signed-in role lacks this. */
  permission: Permission;
  description: string;
};

const NAV: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    permission: "dashboard:view",
    description: "Revenue, orders and stock at a glance",
  },
  {
    href: "/admin/orders",
    label: "Orders",
    permission: "orders:read",
    description: "Fulfil and track orders",
  },
  {
    href: "/admin/products",
    label: "Products",
    permission: "products:read",
    description: "The catalogue and its stock",
  },
  {
    href: "/admin/customers",
    label: "Customers",
    permission: "customers:read",
    description: "Accounts and what they have spent",
  },
  {
    href: "/admin/access",
    label: "Roles and access",
    permission: "admin:access",
    description: "Who can do what",
  },
  {
    href: "/admin/settings",
    label: "Settings",
    permission: "settings:read",
    description: "Store and integration status",
  },
];

/**
 * Admin side navigation.
 *
 * Entries the signed-in role cannot use are not rendered at all, rather than
 * shown disabled: a staff account should not have to learn what it is missing
 * by clicking. The API enforces the same permissions independently, so hiding
 * a link is presentation, never the security boundary.
 */
export function AdminSidebar({
  role,
  email,
}: {
  role: Role;
  email?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const visible = NAV.filter((item) => can(role, item.permission));

  const nav = (
    <nav aria-label="Admin sections" className="flex flex-col gap-1">
      {visible.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href as Route}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex flex-col gap-0.5 border-l-2 py-2.5 pl-4",
              "transition-[border-color,background-color,color] duration-(--duration-quick) ease-out-soft",
              active
                ? "border-paper bg-wash-inverse text-paper"
                : "border-transparent text-muted-inverse hover:border-line-inverse hover:text-paper",
            )}
          >
            <span className="type-wide text-xs tracking-wide-caps uppercase">
              {item.label}
            </span>
            <span className="text-[0.6875rem] text-subtle-inverse">
              {item.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  const identity = (
    <div className="border-t border-line-inverse pt-5">
      <p className="eyebrow text-subtle-inverse">Signed in</p>
      <p className="mt-2 truncate text-xs text-paper">{email}</p>
      <p className="mt-1 text-[0.6875rem] text-muted-inverse">
        {ROLE_LABELS[role]}
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <Link
          href="/"
          className="type-wide text-[0.625rem] tracking-wide-caps text-muted-inverse uppercase hover:text-paper"
        >
          Back to store
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="type-wide cursor-pointer text-left text-[0.625rem] tracking-wide-caps text-muted-inverse uppercase hover:text-paper"
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile bar */}
      <div className="surface-inverse flex items-center justify-between px-5 py-4 lg:hidden">
        <Logo className="text-base" />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-nav"
          onClick={() => setOpen((v) => !v)}
          className="type-wide cursor-pointer border border-line-inverse px-3 py-2 text-[0.625rem] tracking-wide-caps text-paper uppercase"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <div
        id="admin-nav"
        inert={!open}
        className={cn(
          "surface-inverse overflow-hidden px-5 lg:hidden",
          "transition-[max-height,opacity] duration-(--duration-base) ease-out-soft",
          open ? "max-h-[36rem] opacity-100 pb-6" : "max-h-0 opacity-0",
        )}
      >
        {nav}
        <div className="mt-6">{identity}</div>
      </div>

      {/* Desktop rail. The aside stretches to the full column height so the
          black band never stops partway down a long page, while the panel
          inside it sticks to the viewport as the content scrolls past. */}
      <aside className="surface-inverse hidden w-72 shrink-0 lg:block">
        <div className="sticky top-0 flex h-dvh flex-col justify-between p-6">
          <div className="min-h-0 overflow-y-auto">
            <Logo className="text-base" />
            <p className="eyebrow mt-6 mb-3 pl-4 text-subtle-inverse">Manage</p>
            {nav}
          </div>
          {identity}
        </div>
      </aside>
    </>
  );
}
