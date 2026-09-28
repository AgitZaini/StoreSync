import { useId } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-7" />
      <span className={cn("text-[19px] font-bold tracking-tight", inverted ? "text-white" : "text-ink")}>
        StoreSync
      </span>
    </span>
  );
}

export function LogoMark({ className }: { className?: string }) {
  const gradientId = useId();

  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="3" x2="25" y1="4" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5c8ff7" />
          <stop offset="1" stopColor="#1c4ccc" />
        </linearGradient>
      </defs>
      <path
        d="M10 4h15l-7 20H3z"
        fill={`url(#${gradientId})`}
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="14" r="3.6" fill="#fff" />
    </svg>
  );
}

export function Card({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card", className)}>
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export type Trend = { value: number; direction: "up" | "down" } | { label: string; tone: PillTone };

export function StatCard({
  label,
  value,
  title,
  icon: Icon,
  trend,
  caption,
}: {
  label: string;
  value: string;
  title?: string;
  icon: LucideIcon;
  trend?: Trend;
  caption: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[15px] font-medium text-ink">{label}</p>
        <Icon className="size-[18px] shrink-0 text-brand-500" strokeWidth={2} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <p title={title} className="text-[26px] font-semibold leading-none tracking-tight text-ink tabular-nums">
          {value}
        </p>
        {trend ? <TrendBadge trend={trend} /> : null}
      </div>
      <p className="mt-2.5 truncate text-xs text-muted">{caption}</p>
    </div>
  );
}

function TrendBadge({ trend }: { trend: Trend }) {
  if ("label" in trend) {
    return (
      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", pillTones[trend.tone])}>{trend.label}</span>
    );
  }

  const isUp = trend.direction === "up";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        isUp ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500",
      )}
    >
      <svg viewBox="0 0 8 6" className={cn("size-2 fill-current", !isUp && "rotate-180")} aria-hidden="true">
        <path d="M4 0 8 6H0z" />
      </svg>
      {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(trend.value)}%
    </span>
  );
}

export function DataTable({
  headers,
  rows,
  emphasizeFirst = true,
  minWidth = "min-w-[480px]",
}: {
  headers: string[];
  rows: ReactNode[][];
  emphasizeFirst?: boolean;
  minWidth?: string;
}) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className={cn("w-full border-collapse text-left text-sm", minWidth)}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="whitespace-nowrap border-b border-line pb-3 pr-5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle last:pr-0"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="py-10 text-center text-sm text-muted">
                Belum ada data.
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="transition-colors hover:bg-canvas/60">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      "py-3.5 pr-5 text-muted tabular-nums last:pr-0",
                      emphasizeFirst && cellIndex === 0 && "font-medium text-ink",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: ReactNode;
}) {
  return (
    <label className="grid content-start gap-1.5">
      <span className="text-[13px] font-medium text-gray-700">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-xs font-medium text-red-600">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

const noticeTones = {
  blue: "bg-brand-50 text-brand-700",
  red: "bg-red-50 text-red-600",
  green: "bg-green-50 text-green-700",
};

export function Notice({ children, tone = "blue" }: { children: ReactNode; tone?: keyof typeof noticeTones }) {
  return (
    <p role={tone === "red" ? "alert" : "status"} className={cn("rounded-xl px-3.5 py-2.5 text-sm font-medium", noticeTones[tone])}>
      {children}
    </p>
  );
}

export function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-8 text-center">
      <span className="grid size-10 place-items-center rounded-xl bg-canvas text-subtle">
        <Icon className="size-5" />
      </span>
      <p className="max-w-xs text-sm text-muted">{children}</p>
    </div>
  );
}

export type PillTone = "green" | "red" | "orange" | "blue" | "violet" | "gray" | "dark";

const pillTones: Record<PillTone, string> = {
  green: "bg-green-50 text-green-600",
  red: "bg-red-50 text-red-600",
  orange: "bg-orange-50 text-orange-600",
  blue: "bg-brand-50 text-brand-600",
  violet: "bg-violet-50 text-violet-600",
  gray: "bg-gray-100 text-gray-600",
  dark: "bg-ink text-white",
};

export function Pill({ tone, children, className }: { tone: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
        pillTones[tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-400 to-brand-700 text-xs font-semibold text-white",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Memuat"
      className={cn("inline-block size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600", className)}
    />
  );
}

export function LoadingScreen({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="size-10" />
        <Spinner />
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  );
}
