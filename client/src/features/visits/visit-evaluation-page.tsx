import { ClipboardList, Lock, LockOpen } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Card, DataTable, EmptyState, Notice, PageHeader, Pill, Spinner } from "../../components/ui";
import { WeekNavigator } from "../../components/week-navigator";
import { getErrorMessage } from "../../lib/api";
import { formatDateTime, formatDuration, mondayOf, todayDate } from "../../lib/format";
import { cn } from "../../lib/utils";
import { PlanSummaryChips, VisitEvaluationDays } from "./visit-evaluation-days";
import { useVisitPlan, useVisitPlanSummary } from "./visits-api";

const isDate = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

/** KNJ-02: Super Admin (dan Admin) membandingkan rencana kunjungan Team Leader dengan kunjungan nyata. */
export function VisitEvaluationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedWeek = searchParams.get("minggu");
  const weekStart = isDate(requestedWeek) ? mondayOf(requestedWeek) : mondayOf(todayDate());
  const summary = useVisitPlanSummary(weekStart);
  const leaderId = searchParams.get("leader") ?? summary.data?.leaders[0]?.leader.id ?? null;
  const detail = useVisitPlan(weekStart, leaderId, { enabled: Boolean(leaderId) });

  const update = (next: { minggu?: string; leader?: string | null }) => {
    const params = new URLSearchParams(searchParams);
    if (next.minggu) params.set("minggu", next.minggu);
    if (next.leader !== undefined) {
      if (next.leader) params.set("leader", next.leader);
      else params.delete("leader");
    }
    setSearchParams(params, { replace: true });
  };

  const week = detail.data && detail.data.leader.id === leaderId ? detail.data : null;

  return (
    <>
      <PageHeader title="Evaluasi Kunjungan" description="Rencana kunjungan Team Leader dibanding kunjungan nyata, per hari." />
      <Card>
        <WeekNavigator weekStart={weekStart} onChange={(next) => update({ minggu: next })} />
      </Card>

      <Card title="Semua Team Leader">
        {!summary.data ? (
          <div className="grid place-items-center py-10">
            {summary.error ? <Notice tone="red">{getErrorMessage(summary.error)}</Notice> : <Spinner />}
          </div>
        ) : summary.data.leaders.length === 0 ? (
          <EmptyState icon={ClipboardList}>Belum ada Team Leader.</EmptyState>
        ) : (
          <DataTable
            minWidth="min-w-[760px]"
            headers={["Team Leader", "Rencana", "Dikunjungi", "Tidak dikunjungi", "Tanpa alasan", "Di luar rencana", "Total durasi"]}
            rows={summary.data.leaders.map((row) => [
              <button
                key="leader"
                type="button"
                onClick={() => update({ leader: row.leader.id })}
                className={cn("block text-left hover:text-brand-600", row.leader.id === leaderId && "text-brand-600")}
              >
                <span className="block font-medium">{row.leader.name}</span>
                <span className="block text-xs font-normal text-muted">{row.leader.team?.name ?? "Belum memimpin tim"}</span>
              </button>,
              row.hasPlan ? row.summary.planned : <Pill key="none" tone="orange">Belum ada rencana</Pill>,
              <span key="visited" className="text-green-600">{row.summary.visited}</span>,
              <span key="missed" className={row.summary.missed > 0 ? "text-red-600" : undefined}>{row.summary.missed}</span>,
              <span key="reason" className={row.summary.missingReason > 0 ? "font-semibold text-orange-600" : undefined}>{row.summary.missingReason}</span>,
              row.summary.unplanned,
              formatDuration(row.summary.totalMinutes),
            ])}
          />
        )}
      </Card>

      {leaderId ? (
        !week ? (
          <div className="grid place-items-center py-10">
            {detail.error ? <Notice tone="red">{getErrorMessage(detail.error)}</Notice> : <Spinner />}
          </div>
        ) : (
          <>
            <Card
              title={week.leader.name}
              action={
                week.isLocked ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <Lock className="size-3.5 text-orange-500" /> Terkunci {formatDateTime(week.lockedAt)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <LockOpen className="size-3.5 text-green-600" /> Belum terkunci
                  </span>
                )
              }
            >
              <PlanSummaryChips summary={week.summary} />
              <p className="mt-3 text-xs text-muted">
                Penanda “Ditambah setelah terkunci” dan apotek yang dicoret menunjukkan perubahan setelah Senin 00.00 WIB; setiap perubahan
                tercatat di Riwayat.
              </p>
            </Card>
            <VisitEvaluationDays week={week} />
          </>
        )
      ) : null}
    </>
  );
}
