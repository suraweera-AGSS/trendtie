"use client";

import { useEffect, useState } from "react";
import {
  BarList,
  ChartCard,
  RevenueChart,
  StatTile,
  barTable,
  revenueTable,
  type BarDatum,
  type RevenuePoint,
} from "@/components/admin/charts";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Analytics = {
  range: { days: number; from: string | null; to: string | null };
  totals: {
    revenue: number;
    orders: number;
    averageOrderValue: number;
    products: number;
    customers: number;
  };
  deltas: { revenue: number | null; orders: number | null };
  series: RevenuePoint[];
  ordersByStatus: { status: string; count: number; revenue: number }[];
  topProducts: { productId: string; name: string; units: number; revenue: number }[];
  stock: { id: string; name: string; slug: string; stock: number }[];
  stockByCategory: { category: string; products: number; stock: number }[];
};

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

/**
 * The analytics half of the dashboard.
 *
 * One filter row scopes every chart below it, rather than each card carrying
 * its own range control. On refetch the previous render is held at reduced
 * opacity instead of collapsing to a skeleton, so the layout never jumps.
 */
export function DashboardCharts() {
  const [days, setDays] = useState<number>(30);
  // The loaded payload is stored with the range it belongs to, so "is this
  // stale" is derived rather than tracked in a separate loading flag that an
  // effect would have to set synchronously.
  const [result, setResult] = useState<{ days: number; data: Analytics } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const data = result?.data ?? null;
  const loading = !result || result.days !== days;

  useEffect(() => {
    const controller = new AbortController();

    // Every setState runs in a promise continuation, never synchronously in
    // the effect body, so this cannot cascade renders.
    fetch(`/api/admin/analytics?days=${days}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body: Analytics) => {
        setResult({ days, data: body });
        setError(null);
      })
      .catch((cause) => {
        if (cause?.name === "AbortError") return;
        setError("Could not load analytics.");
      });

    return () => controller.abort();
  }, [days]);

  if (error) {
    return (
      <p role="alert" className="mt-10 border border-ink p-5 text-sm">
        {error}
      </p>
    );
  }

  if (!data) {
    return (
      <div className="mt-10 h-64 animate-pulse border border-line bg-wash" aria-hidden />
    );
  }

  const statusBars: BarDatum[] = data.ordersByStatus.map((row) => ({
    label: row.status,
    value: row.count,
    display: String(row.count),
  }));

  const productBars: BarDatum[] = data.topProducts.map((row) => ({
    label: row.name,
    value: row.revenue,
    display: formatPrice(row.revenue),
  }));

  const stockBars: BarDatum[] = data.stock.slice(0, 6).map((row) => ({
    label: row.name,
    value: row.stock,
    display: String(row.stock),
  }));

  const sparkline = data.series.map((point) => point.revenue);

  return (
    <div className={cn("mt-10", loading && "opacity-60 transition-opacity")}>
      {/* One filter row, above everything it scopes. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-muted">
          {data.range.from} to {data.range.to}
        </p>
        <div className="flex gap-2">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              onClick={() => setDays(range.days)}
              aria-pressed={days === range.days}
              className={cn(
                "type-wide cursor-pointer border px-3 py-1.5 text-[0.625rem] tracking-wide-caps uppercase",
                "transition-[background-color,color,border-color] duration-(--duration-quick) ease-out-soft",
                days === range.days
                  ? "border-ink bg-ink text-paper"
                  : "border-line text-muted hover:border-ink",
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <dl className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          hero
          label={`Revenue, last ${data.range.days} days`}
          value={formatPrice(data.totals.revenue)}
          delta={data.deltas.revenue}
          note="vs the previous period"
          spark={sparkline}
        />
        <StatTile
          label="Orders"
          value={String(data.totals.orders)}
          delta={data.deltas.orders}
          note="vs the previous period"
        />
        <StatTile
          label="Average order"
          value={formatPrice(data.totals.averageOrderValue)}
          note="Across non-cancelled orders"
        />
        <StatTile
          label="Customers"
          value={String(data.totals.customers)}
          note={`${data.totals.products} products live`}
        />
      </dl>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <ChartCard
          className="xl:col-span-2"
          title="Revenue per day"
          subtitle="Cancelled orders excluded. Hover for a single day."
          table={revenueTable(data.series)}
        >
          <RevenueChart data={data.series} />
        </ChartCard>

        <ChartCard
          title="Orders by status"
          subtitle="Shaded along the fulfilment path, pending through cancelled."
          table={barTable(["Status", "Orders"], statusBars)}
        >
          {/* Ordinal ramp is correct here: these stages have a real order. */}
          <BarList data={statusBars} ordinal emptyMessage="No orders yet." />
        </ChartCard>

        <ChartCard
          title="Top products by revenue"
          subtitle="All time, cancelled orders excluded."
          table={barTable(["Product", "Revenue"], productBars)}
        >
          {/* Nominal categories: one ink fill for every bar. */}
          <BarList data={productBars} emptyMessage="No sales yet." />
        </ChartCard>

        <ChartCard
          className="xl:col-span-2"
          title="Lowest stock"
          subtitle="Units remaining across every size."
          table={barTable(["Product", "Units"], stockBars)}
        >
          <BarList data={stockBars} emptyMessage="No products yet." />
        </ChartCard>
      </div>
    </div>
  );
}
