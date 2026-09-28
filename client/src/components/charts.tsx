import { useId, useState } from "react";
import type { PointerEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { formatCompactNumber, formatCurrency, formatShortDate } from "../lib/format";
import type { DailySales, WeekdayActivity } from "../lib/sales-insights";
import { cn } from "../lib/utils";

/** Rounds `value` up so it splits into `steps` evenly sized, readable ticks. */
function niceMax(value: number, steps: number) {
  if (value <= 0) {
    return steps;
  }

  const step = value / steps;
  const magnitude = 10 ** Math.floor(Math.log10(step));
  const normalized = step / magnitude;
  const niceStep = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;

  return niceStep * magnitude * steps;
}

export function SalesTrendChart({ points }: { points: DailySales[] }) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...points.map((point) => point.total)), 3);
  const ticks = [3, 2, 1, 0].map((index) => (max / 3) * index);
  const last = points.length - 1;
  const x = (index: number) => (last <= 0 ? 50 : (index / last) * 100);
  const y = (value: number) => 100 - (value / max) * 100;
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.total)}`).join(" ");
  const labelIndexes = [...new Set([0, 7, 14, 21, last].filter((index) => index >= 0 && index <= last))];
  const activePoint = active === null ? null : points[active];

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    setActive(Math.round(ratio * last));
  };

  return (
    <div className="select-none">
      <div className="flex">
        <div className="relative h-44 w-12 shrink-0">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-3 -translate-y-1/2 text-[11px] text-subtle tabular-nums"
              style={{ top: `${y(tick)}%` }}
            >
              {formatCompactNumber(tick)}
            </span>
          ))}
        </div>
        <div
          className="relative h-44 flex-1 touch-pan-y"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setActive(null)}
        >
          <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" style={{ stopColor: "var(--color-brand-500)", stopOpacity: 0.2 }} />
                <stop offset="1" style={{ stopColor: "var(--color-brand-500)", stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {ticks.map((tick) => (
              <line
                key={tick}
                x1="0"
                x2="100"
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-line"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={`${line} L100,100 L0,100 Z`} fill={`url(#${gradientId})`} />
            <path
              d={line}
              fill="none"
              className="stroke-brand-500"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {activePoint && active !== null ? (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 border-l border-dashed border-gray-300"
                style={{ left: `${x(active)}%` }}
              />
              <div
                className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-600 shadow-md"
                style={{ left: `${x(active)}%`, top: `${y(activePoint.total)}%` }}
              />
              <div
                className="pointer-events-none absolute top-1 z-10 w-max rounded-xl border border-line bg-white px-3 py-2.5 text-xs shadow-pop"
                style={{
                  left: `${x(active)}%`,
                  transform: x(active) > 55 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
                }}
              >
                <p className="font-semibold text-ink">{formatShortDate(activePoint.date)}</p>
                <p className="mt-1.5 flex items-center gap-2 text-muted">
                  <span className="h-0.5 w-3 rounded-full bg-brand-500" />
                  <span className="font-semibold text-ink">{formatCurrency(activePoint.total)}</span>
                </p>
                <p className="mt-1 pl-5 text-muted">{activePoint.count} transaksi</p>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div className="relative ml-12 mt-2 h-4 text-[11px] text-subtle">
        {labelIndexes.map((index) => (
          <span
            key={index}
            className={cn(
              "absolute whitespace-nowrap",
              index === 0 ? "" : index === last ? "-translate-x-full" : "-translate-x-1/2",
            )}
            style={{ left: `${x(index)}%` }}
          >
            {formatShortDate(points[index].date)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function WeekdayBars({ data }: { data: WeekdayActivity[] }) {
  const max = Math.max(...data.map((day) => day.count), 0);
  const peak = max > 0 ? data.findIndex((day) => day.count === max) : -1;

  return (
    <div className="grid h-48 grid-cols-7 gap-2">
      {data.map((day, index) => {
        const isPeak = index === peak;
        const height = max > 0 ? Math.max((day.count / max) * 100, 14) : 14;

        return (
          <div
            key={day.label}
            className="group flex min-w-0 flex-col items-center gap-2"
            title={`${day.label}: ${day.count} transaksi · ${formatCurrency(day.total)}`}
          >
            <div className="flex w-full max-w-9 flex-1 flex-col items-center justify-end">
              <span
                className={cn(
                  "mb-1.5 text-xs font-semibold tabular-nums",
                  isPeak ? "text-ink" : "text-transparent group-hover:text-muted",
                )}
              >
                {day.count}
              </span>
              <div
                className={cn(
                  "w-full rounded-[10px] transition-colors",
                  isPeak
                    ? "bg-linear-to-b from-brand-400 to-brand-600 shadow-[0_8px_18px_-8px_rgb(35_96_232/0.7)]"
                    : "bg-linear-to-b from-gray-100 to-gray-200/70 group-hover:from-gray-200 group-hover:to-gray-200",
                )}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className={cn("text-xs", isPeak ? "font-semibold text-brand-600" : "text-muted")}>{day.label}</span>
          </div>
        );
      })}
    </div>
  );
}

const gaugeTones = {
  green: "stroke-green-500",
  orange: "stroke-orange-500",
  red: "stroke-red-500",
};

export function RadialGauge({ value, tone }: { value: number; tone: keyof typeof gaugeTones }) {
  const tickCount = 46;
  const filled = Math.round((Math.min(Math.max(value, 0), 100) / 100) * tickCount);
  const center = { x: 120, y: 118 };

  return (
    <svg viewBox="0 0 240 158" className="w-full" aria-hidden="true">
      {Array.from({ length: tickCount }, (_, index) => {
        const angle = ((200 - (220 * index) / (tickCount - 1)) * Math.PI) / 180;
        const isOn = index < filled;

        return (
          <line
            key={index}
            x1={center.x + 80 * Math.cos(angle)}
            y1={center.y - 80 * Math.sin(angle)}
            x2={center.x + 102 * Math.cos(angle)}
            y2={center.y - 102 * Math.sin(angle)}
            className={isOn ? gaugeTones[tone] : "stroke-gray-200"}
            style={isOn ? { opacity: 0.35 + 0.65 * (index / Math.max(filled - 1, 1)) } : undefined}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

const splitColors = {
  blue: { icon: "text-brand-500", border: "border-brand-500", bar: "from-brand-400 to-brand-600" },
  green: { icon: "text-green-500", border: "border-green-500", bar: "from-green-400 to-green-500" },
  orange: { icon: "text-orange-500", border: "border-orange-500", bar: "from-orange-300 to-orange-500" },
  gray: { icon: "text-gray-400", border: "border-gray-300", bar: "from-gray-200 to-gray-300" },
};

export type SplitSegment = {
  label: string;
  value: number;
  caption: string;
  icon: LucideIcon;
  color: keyof typeof splitColors;
};

export function SplitBar({ segments }: { segments: SplitSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="flex gap-2">
      {segments.map((segment) => {
        const colors = splitColors[segment.color];
        const Icon = segment.icon;

        return (
          <div
            key={segment.label}
            className="flex min-w-0 flex-col"
            style={{ flexBasis: 0, flexGrow: total > 0 ? Math.max(segment.value / total, 0.18) : 1 }}
          >
            <div className={cn("border-l-2 pb-3 pl-3", colors.border)}>
              <p className="flex items-center gap-1.5 text-lg font-semibold leading-tight text-ink tabular-nums">
                <Icon className={cn("size-4 shrink-0", colors.icon)} />
                {segment.value}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">{segment.label}</p>
              <p className="truncate text-xs text-subtle">{segment.caption}</p>
            </div>
            <div className={cn("h-1.5 rounded-r-full bg-linear-to-r", colors.bar)} />
          </div>
        );
      })}
    </div>
  );
}
