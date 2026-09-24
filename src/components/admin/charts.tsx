"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Chart primitives for the admin dashboard, drawn as plain SVG.
 *
 * The brand has one colour, so identity cannot be carried by hue. These
 * charts lean on position, length, an ordinal ink ramp and direct labels
 * instead, and every one of them ships a table view so no value is reachable
 * only by hovering.
 *
 * Conventions, applied consistently: 2px lines with round caps, bars capped
 * at 24px with a rounded data-end and a square baseline, hairline solid
 * gridlines one step off the surface, and markers with a 2px surface ring.
 */

/** Measure the container so text stays at its intended size at any width. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

function shortDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------

export type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  table: React.ReactNode;
  className?: string;
};

/** Card chrome plus the table-view twin every chart is required to have. */
export function ChartCard({
  title,
  subtitle,
  children,
  table,
  className,
}: ChartCardProps) {
  return (
    <section className={cn("border border-line p-6", className)}>
      <header>
        <h2 className="type-wide text-sm font-semibold">{title}</h2>
        {subtitle && <p className="mt-1.5 text-xs text-muted">{subtitle}</p>}
      </header>

      <div className="mt-6">{children}</div>

      <details className="mt-5 border-t border-line pt-4">
        <summary className="type-wide cursor-pointer text-[0.625rem] tracking-wide-caps text-muted uppercase">
          Table view
        </summary>
        <div className="mt-4 overflow-x-auto">{table}</div>
      </details>
    </section>
  );
}

function DataTable({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-line">
          {head.map((cell, i) => (
            <th
              key={cell}
              scope="col"
              className={cn(
                "eyebrow py-2 text-muted",
                i === 0 ? "text-left" : "text-right",
              )}
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-b border-line last:border-0">
            {row.map((cell, i) => (
              <td
                key={i}
                className={cn(
                  "py-2",
                  i === 0 ? "text-left" : "text-right tabular-nums",
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------

export type RevenuePoint = { date: string; revenue: number; orders: number };

/**
 * Revenue over time. One series, so there is no legend: the title names it.
 * The endpoint is direct-labelled and the rest is left to the axis and the
 * crosshair, rather than printing a number on every point.
 */
export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const height = 260;
  const pad = { top: 16, right: 16, bottom: 28, left: 56 };
  const plotWidth = Math.max(width - pad.left - pad.right, 10);
  const plotHeight = height - pad.top - pad.bottom;

  const max = niceCeiling(Math.max(...data.map((d) => d.revenue), 1));
  const x = (i: number) =>
    pad.left + (data.length <= 1 ? 0 : (i / (data.length - 1)) * plotWidth);
  const y = (value: number) => pad.top + plotHeight - (value / max) * plotHeight;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(d.revenue)}`).join(" ");
  const area =
    data.length > 0
      ? `${line} L${x(data.length - 1)} ${pad.top + plotHeight} L${x(0)} ${pad.top + plotHeight} Z`
      : "";

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => max * t);
  const last = data.at(-1);

  const onMove = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      const relative = event.clientX - box.left;
      const index = Math.round((relative / Math.max(box.width, 1)) * (data.length - 1));
      setActive(Math.min(Math.max(index, 0), data.length - 1));
    },
    [data.length],
  );

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Revenue per day for the last ${data.length} days`}
        >
          {/* Hairline grid, solid, one step off the surface. */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={pad.left + plotWidth}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={pad.left - 10}
                y={y(tick) + 4}
                textAnchor="end"
                className="fill-muted text-[10px] tabular-nums"
              >
                {formatPrice(tick)}
              </text>
            </g>
          ))}

          <path d={area} fill="var(--color-wash)" />
          <path
            d={line}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Endpoint marker, with a surface ring so it reads off the line. */}
          {last && (
            <circle
              cx={x(data.length - 1)}
              cy={y(last.revenue)}
              r={4}
              fill="var(--color-ink)"
              stroke="var(--color-paper)"
              strokeWidth={2}
            />
          )}

          {active !== null && data[active] && (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={pad.top}
                y2={pad.top + plotHeight}
                stroke="var(--color-line-strong)"
                strokeWidth={1}
              />
              <circle
                cx={x(active)}
                cy={y(data[active].revenue)}
                r={4}
                fill="var(--color-ink)"
                stroke="var(--color-paper)"
                strokeWidth={2}
              />
            </g>
          )}

          {/* x labels: first, middle and last only. */}
          {[0, Math.floor((data.length - 1) / 2), data.length - 1]
            .filter((i, idx, arr) => i >= 0 && arr.indexOf(i) === idx)
            .map((i) => (
              <text
                key={i}
                x={x(i)}
                y={height - 8}
                textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                className="fill-muted text-[10px]"
              >
                {data[i] ? shortDate(data[i].date) : ""}
              </text>
            ))}

          <rect
            x={pad.left}
            y={pad.top}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setActive(null)}
          />
        </svg>
      )}

      {active !== null && data[active] && (
        <div
          className="pointer-events-none absolute top-2 border border-ink bg-paper px-3 py-2 text-xs shadow-lift"
          style={{
            left: Math.min(Math.max(x(active) - 60, 0), Math.max(width - 130, 0)),
          }}
        >
          <p className="eyebrow text-muted">{shortDate(data[active].date)}</p>
          <p className="mt-1.5 tabular-nums">{formatPrice(data[active].revenue)}</p>
          <p className="text-muted tabular-nums">
            {data[active].orders} order{data[active].orders === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </div>
  );
}

export function revenueTable(data: RevenuePoint[]) {
  return (
    <DataTable
      head={["Date", "Orders", "Revenue"]}
      rows={data.map((d) => [shortDate(d.date), d.orders, formatPrice(d.revenue)])}
    />
  );
}

// ---------------------------------------------------------------------------

export type BarDatum = { label: string; value: number; display?: string };

/**
 * Horizontal bars.
 *
 * `ordinal` shades the bars along the ink ramp, and is only correct when the
 * categories have a real order. Nominal categories keep a single ink fill.
 */
export function BarList({
  data,
  ordinal = false,
  emptyMessage = "Nothing to show yet.",
}: {
  data: BarDatum[];
  ordinal?: boolean;
  emptyMessage?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="py-8 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {data.map((item, index) => {
        const percent = (item.value / max) * 100;
        const fill = ordinal
          ? `var(--color-ramp-${Math.min(index + 1, 4)})`
          : "var(--color-ink)";

        return (
          <li key={item.label}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="truncate text-xs">{item.label}</span>
              <span className="shrink-0 text-xs tabular-nums">
                {item.display ?? item.value}
              </span>
            </div>
            {/* Track is the surface wash; the bar grows from a single baseline
                and carries a rounded data-end. 10px keeps the mark thin. */}
            <div className="mt-2 h-2.5 w-full bg-wash">
              <div
                className="h-full rounded-r-[4px]"
                style={{
                  width: `${Math.max(percent, item.value > 0 ? 2 : 0)}%`,
                  backgroundColor: fill,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function barTable(head: [string, string], data: BarDatum[]) {
  return (
    <DataTable
      head={[head[0], head[1]]}
      rows={data.map((d) => [d.label, d.display ?? d.value])}
    />
  );
}

// ---------------------------------------------------------------------------

/** Sparkline for a stat tile: shape only, no axes, no labels. */
export function Sparkline({ values }: { values: number[] }) {
  const width = 96;
  const height = 24;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${i * step} ${height - (v / max) * height}`)
    .join(" ");

  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <path
        d={path}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Stat tile. Proportional figures on the value, because equal-width digits
 * make a large number look loosely spaced.
 */
export function StatTile({
  label,
  value,
  delta,
  note,
  spark,
  hero = false,
}: {
  label: string;
  value: string;
  delta?: number | null;
  note?: string;
  spark?: number[];
  hero?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between bg-paper p-6">
      <p className="eyebrow text-muted">{label}</p>

      <div className="mt-4 flex items-end justify-between gap-4">
        <p className={cn("font-semibold", hero ? "text-4xl" : "text-2xl")}>{value}</p>
        {spark && spark.length > 1 && <Sparkline values={spark} />}
      </div>

      {(delta !== undefined || note) && (
        <p className="mt-3 text-xs text-muted">
          {delta === null || delta === undefined ? (
            note
          ) : (
            <>
              <span className="tabular-nums">
                {delta > 0 ? "+" : ""}
                {delta}%
              </span>{" "}
              {note}
            </>
          )}
        </p>
      )}
    </div>
  );
}
