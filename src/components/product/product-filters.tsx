"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useCallback } from "react";
import { CATEGORIES, SIZES } from "@/lib/site-config";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "name", label: "A to Z" },
] as const;

/**
 * Filter bar. State lives in the URL rather than in React, so a filtered view
 * is shareable, survives a refresh, and works with the back button.
 */
export function ProductFilters({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || next.get(key) === value) next.delete(key);
      else next.set(key, value);
      // Any filter change invalidates the current page number.
      next.delete("page");
      const query = next.toString();
      // Built from live search params, so typed routes cannot verify it.
      router.push((query ? `${pathname}?${query}` : pathname) as Route, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  const category = params.get("category");
  const size = params.get("size");
  const sort = params.get("sort") ?? "newest";
  const inStock = params.get("inStock") === "true";
  const hasFilters = Boolean(category || size || inStock);

  return (
    <div className="flex flex-col gap-6 border-b border-line pb-8">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <span className="eyebrow mr-2 text-muted">Category</span>
        <FilterChip
          label="All"
          active={!category}
          onClick={() => update("category", null)}
        />
        {CATEGORIES.map((value) => (
          <FilterChip
            key={value}
            label={value}
            active={category === value}
            onClick={() => update("category", value)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <span className="eyebrow mr-2 text-muted">Size</span>
        {SIZES.map((value) => (
          <FilterChip
            key={value}
            label={value === "ONE_SIZE" ? "One size" : value}
            active={size === value}
            onClick={() => update("size", value)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <label className="type-wide flex cursor-pointer items-center gap-2.5 text-xs tracking-wide-caps uppercase">
            <input
              type="checkbox"
              checked={inStock}
              onChange={() => update("inStock", inStock ? null : "true")}
              className="size-4 cursor-pointer accent-black"
            />
            In stock only
          </label>

          {hasFilters && (
            <button
              type="button"
              onClick={() => router.push(pathname as Route, { scroll: false })}
              className="underline-draw type-wide cursor-pointer text-xs tracking-wide-caps text-muted uppercase"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-muted tabular-nums">
            {total} {total === 1 ? "product" : "products"}
          </span>
          <label className="flex items-center gap-2">
            <span className="sr-only">Sort by</span>
            <select
              value={sort}
              onChange={(event) => update("sort", event.target.value)}
              className="type-wide cursor-pointer border border-line bg-paper px-3 py-2 text-xs tracking-wide-caps uppercase"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "type-wide cursor-pointer border px-3.5 py-2 text-[0.6875rem] tracking-wide-caps uppercase",
        "transition-[background-color,color,border-color] duration-(--duration-quick) ease-out-soft",
        active
          ? "border-ink bg-ink text-paper"
          : "border-line text-ink hover:border-ink",
      )}
    >
      {label}
    </button>
  );
}
