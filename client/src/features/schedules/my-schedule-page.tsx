import { CalendarDays } from "lucide-react";
import { Card, EmptyState, PageHeader, Spinner } from "../../components/ui";
import { formatBusinessDate, formatScheduleValue, mondayOf, shiftDate, todayDate } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { ScheduleWeek } from "../../types/attendance";
import { useScheduleWeek } from "./schedules-api";

function WeekCard({ title, week }: { title: string; week: ScheduleWeek | undefined }) {
  const today = todayDate();

  if (!week) {
    return (
      <Card title={title}>
        <div className="grid place-items-center py-10">
          <Spinner />
        </div>
      </Card>
    );
  }

  const hasAny = week.rows.some((row) => Object.keys(row.entries).length > 0);

  return (
    <Card
      title={title}
      action={
        <span className="text-xs text-muted">
          {formatBusinessDate(week.dates[0], { day: "numeric", month: "short" })} –{" "}
          {formatBusinessDate(week.dates[6], { day: "numeric", month: "short" })}
        </span>
      }
    >
      {!hasAny ? (
        <EmptyState icon={CalendarDays}>Jadwal belum diisi Admin.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {week.dates.map((date) => {
            const entries = week.rows
              .map((row) => ({ pharmacy: row.pharmacy.name, value: row.entries[date] }))
              .filter((entry) => entry.value);

            return (
              <li key={date} className={cn("flex gap-4 py-3", date === today && "-mx-3 rounded-xl bg-brand-50/60 px-3")}>
                <span className="w-24 shrink-0 text-sm font-medium text-ink">
                  {formatBusinessDate(date)}
                  {date === today ? <span className="block text-[11px] font-semibold text-brand-600">Hari ini</span> : null}
                </span>
                <span className="min-w-0 flex-1 space-y-1 text-sm">
                  {entries.length === 0 ? (
                    <span className="text-subtle">-</span>
                  ) : (
                    entries.map((entry) => (
                      <span key={entry.pharmacy} className="flex flex-wrap justify-between gap-x-3">
                        <span className="text-muted">{entry.pharmacy}</span>
                        <span className={cn("font-medium tabular-nums", entry.value!.isOff ? "text-violet-600" : "text-ink")}>
                          {formatScheduleValue(entry.value!)}
                        </span>
                      </span>
                    ))
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** JDW-02: SPG melihat jadwalnya minggu ini dan minggu depan. */
export function MySchedulePage() {
  const thisWeek = mondayOf(todayDate());
  const current = useScheduleWeek(thisWeek);
  const next = useScheduleWeek(shiftDate(thisWeek, 7));

  return (
    <>
      <PageHeader title="Jadwal" description="Jadwal dari Admin. Perubahan jadwal akan dikirim lewat notifikasi." />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <WeekCard title="Minggu ini" week={current.data} />
        <WeekCard title="Minggu depan" week={next.data} />
      </div>
    </>
  );
}
