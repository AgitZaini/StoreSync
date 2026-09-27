import { cn } from "../lib/utils";

export function Tabs<Key extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ key: Key; label: string; count?: number }>;
  value: Key;
  onChange: (key: Key) => void;
}) {
  return (
    <div role="tablist" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-card ring-1 ring-line">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition",
            value === tab.key ? "bg-brand-50 text-brand-700" : "text-muted hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="rounded-md bg-canvas px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted">{tab.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
