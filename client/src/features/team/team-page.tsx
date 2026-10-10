import { CalendarDays, Package, Target, UserCheck, UsersRound } from "lucide-react";
import { useState } from "react";
import { Card, EmptyState, PageHeader, Spinner } from "../../components/ui";
import { currentMonth, formatBusinessDate, formatCurrency, formatMonth, formatScheduleValue, formatTime, mondayOf, todayDate } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { MonitorRow } from "../../types/attendance";
import { useAttendanceMonitor } from "../attendance/attendance-api";
import { RowDetailDialog } from "../attendance/attendance-monitor-page";
import { AttendanceStatusPill } from "../attendance/attendance-status-pill";
import { useSalesPerformance } from "../sales/sales-api";
import { useScheduleWeek } from "../schedules/schedules-api";
import { useFieldStock } from "../stock/stock-api";
import { useTeams } from "../users/users-api";

/** JDW-02 + DSB-01: Team Leader melihat jadwal dan absen SPG timnya (hanya baca). */
export function TeamPage() {
  const today = todayDate();
  const teams = useTeams();
  const monitor = useAttendanceMonitor(today, { live: true });
  const week = useScheduleWeek(mondayOf(today));
  const stock = useFieldStock();
  const month = currentMonth();
  const performance = useSalesPerformance(month);
  const [selected, setSelected] = useState<MonitorRow | null>(null);
  const team = teams.data?.[0];

  if (teams.isPending) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!team) {
    return (
      <>
        <PageHeader title="Tim Saya" />
        <Card>
          <EmptyState icon={UsersRound}>Anda belum memimpin tim. Hubungi Super Admin.</EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={team.name} description={`${team.members.length} SPG · jadwal dan absen hari ini`} />

      <Card title="Absen hari ini">
        {!monitor.data ? (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        ) : monitor.data.rows.length === 0 ? (
          <EmptyState icon={UserCheck}>Tidak ada SPG tim yang terjadwal hari ini.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {monitor.data.rows.map((row) => (
              <li key={`${row.spg.id}:${row.pharmacy.id}`}>
                <button type="button" onClick={() => setSelected(row)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{row.spg.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {row.pharmacy.name} · {row.schedule ? formatScheduleValue(row.schedule) : "tanpa jadwal"}
                      {row.checkIn ? ` · masuk ${formatTime(row.checkIn.serverAt)}` : ""}
                      {row.checkOut ? ` · pulang ${formatTime(row.checkOut.serverAt)}` : ""}
                    </span>
                  </span>
                  <AttendanceStatusPill status={row.status} lateMinutes={row.lateMinutes} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Jadwal minggu ini">
        {!week.data ? (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        ) : week.data.rows.length === 0 ? (
          <EmptyState icon={CalendarDays}>Belum ada SPG tim yang ditempatkan.</EmptyState>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr>
                  <th className="pb-3 pr-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">SPG · Apotek</th>
                  {week.data.dates.map((date) => (
                    <th
                      key={date}
                      className={cn("pb-3 text-center text-[11px] font-semibold uppercase tracking-[0.06em]", date === today ? "text-brand-600" : "text-subtle")}
                    >
                      {formatBusinessDate(date, { weekday: "short", day: "numeric" })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {week.data.rows.map((row) => (
                  <tr key={`${row.spg.id}:${row.pharmacy.id}`}>
                    <td className="py-3 pr-4">
                      <span className="block font-medium text-ink">{row.spg.name}</span>
                      <span className="block text-xs text-muted">{row.pharmacy.name}</span>
                    </td>
                    {week.data!.dates.map((date) => {
                      const value = row.entries[date];
                      return (
                        <td key={date} className={cn("py-3 text-center text-xs tabular-nums", value?.isOff ? "text-violet-600" : value ? "text-ink" : "text-subtle")}>
                          {value ? formatScheduleValue(value) : "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Omzet tim ${formatMonth(month)}`} action={<Target className="size-[18px] text-brand-500" />}>
        {!performance.data ? (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        ) : performance.data.rows.length === 0 ? (
          <EmptyState icon={Target}>Belum ada SPG di tim.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {performance.data.rows.map((row) => (
              <li key={row.spg.id} className="py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium text-ink">{row.spg.name}</span>
                  <span className="shrink-0 tabular-nums text-ink">
                    {formatCurrency(row.approvedAmount)}
                    <span className="text-xs text-muted"> / {row.target ? formatCurrency(row.target) : "tanpa target"}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(row.percent ?? 0, 100)}%` }} />
                </div>
                {row.pendingReports > 0 ? (
                  <p className="mt-1 text-xs text-orange-700">
                    {row.pendingReports} laporan ({formatCurrency(row.pendingAmount)}) menunggu kasir
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Stok tim" action={<Package className="size-[18px] text-brand-500" />}>
        {!stock.data ? (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        ) : stock.data.length === 0 ? (
          <EmptyState icon={Package}>Belum ada stok SPG tim.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {stock.data.map((group) => (
              <li key={`${group.holder.id}:${group.pharmacy.id}`} className="flex items-start justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">
                    {group.holder.name} · {group.pharmacy.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {group.items.filter((item) => item.qty > 0).map((item) => `${item.product.name} ${item.qty}`).join(" · ") || "Belum ada stok"}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{group.totalQty.toLocaleString("id-ID")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selected ? <RowDetailDialog row={selected} date={today} canEdit={false} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
