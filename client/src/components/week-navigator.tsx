import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatBusinessDate, mondayOf, shiftDate, todayDate } from "../lib/format";
import { cn } from "../lib/utils";
import { buttonStyles, iconButtonClass } from "./styles";

/** Pindah minggu (Senin–Minggu) dengan label rentang tanggal dan pintasan "Minggu ini". */
export function WeekNavigator({ weekStart, onChange }: { weekStart: string; onChange: (weekStart: string) => void }) {
  const thisWeek = mondayOf(todayDate());

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(shiftDate(weekStart, -7))} className={iconButtonClass} aria-label="Minggu sebelumnya">
        <ChevronLeft className="size-4" />
      </button>
      <div className="min-w-44 text-center">
        <p className="text-sm font-semibold text-ink">
          {formatBusinessDate(weekStart, { day: "numeric", month: "short" })} –{" "}
          {formatBusinessDate(shiftDate(weekStart, 6), { day: "numeric", month: "short", year: "numeric" })}
        </p>
        {weekStart === thisWeek ? (
          <p className="text-xs text-brand-600">Minggu ini</p>
        ) : weekStart === shiftDate(thisWeek, 7) ? (
          <p className="text-xs text-muted">Minggu depan</p>
        ) : null}
      </div>
      <button type="button" onClick={() => onChange(shiftDate(weekStart, 7))} className={iconButtonClass} aria-label="Minggu berikutnya">
        <ChevronRight className="size-4" />
      </button>
      {weekStart !== thisWeek ? (
        <button type="button" onClick={() => onChange(thisWeek)} className={cn(buttonStyles.ghost, buttonStyles.small)}>
          Minggu ini
        </button>
      ) : null}
    </div>
  );
}
