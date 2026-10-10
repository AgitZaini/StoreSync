import { CalendarRange, FileText, MessageSquareWarning, Paperclip } from "lucide-react";
import { buttonStyles } from "../../components/styles";
import { Card, EmptyState, Pill } from "../../components/ui";
import type { PillTone } from "../../components/ui";
import { useFileUrl } from "../../hooks/use-file-url";
import { formatBusinessDate, formatDateTime, formatDuration, formatTime } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { PlanDay, PlanItem, PlanItemStatus, PlanSummary, VisitPlanWeek } from "../../types/visits";

const PLAN_STATUS: Record<PlanItemStatus, { label: string; tone: PillTone }> = {
  VISITED: { label: "Dikunjungi", tone: "green" },
  MISSED: { label: "Tidak dikunjungi", tone: "red" },
  PENDING: { label: "Belum dikunjungi", tone: "gray" },
  REMOVED: { label: "Dihapus", tone: "gray" },
};

const visitRange = (visit: { checkInAt: string; checkOutAt: string | null }) =>
  `${formatTime(visit.checkInAt)}–${visit.checkOutAt ? formatTime(visit.checkOutAt) : "tanpa absen keluar"}`;

export function EvidenceLink({ evidence }: { evidence: { id: string; mimeType: string } }) {
  const url = useFileUrl(evidence.id);
  const Icon = evidence.mimeType === "application/pdf" ? FileText : Paperclip;

  return url.data ? (
    <a href={url.data} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
      <Icon className="size-3.5" /> Lihat bukti
    </a>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-subtle">
      <Icon className="size-3.5" /> Memuat bukti...
    </span>
  );
}

/** Ringkasan rencana vs kunjungan dalam bentuk angka kecil. */
export function PlanSummaryChips({ summary }: { summary: PlanSummary }) {
  const chips = [
    { label: "Rencana", value: summary.planned, className: "text-ink" },
    { label: "Dikunjungi", value: summary.visited, className: "text-green-600" },
    { label: "Tidak dikunjungi", value: summary.missed, className: "text-red-600" },
    { label: "Tanpa alasan", value: summary.missingReason, className: summary.missingReason > 0 ? "text-orange-600" : "text-ink" },
    { label: "Di luar rencana", value: summary.unplanned, className: "text-brand-600" },
  ];

  return (
    <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {chips.map((chip) => (
        <div key={chip.label} className="rounded-xl bg-canvas px-2 py-2 text-center">
          <dd className={cn("text-lg font-semibold tabular-nums", chip.className)}>{chip.value}</dd>
          <dt className="text-[11px] text-muted">{chip.label}</dt>
        </div>
      ))}
      <div className="rounded-xl bg-canvas px-2 py-2 text-center">
        <dd className="text-lg font-semibold tabular-nums text-ink">{formatDuration(summary.totalMinutes)}</dd>
        <dt className="text-[11px] text-muted">Total kunjungan</dt>
      </div>
    </dl>
  );
}

function PlanItemRow({ item, day, onFillReason }: { item: PlanItem; day: PlanDay; onFillReason?: (item: PlanItem) => void }) {
  const status = PLAN_STATUS[item.status];
  const canExplain = onFillReason && (item.status === "MISSED" || (item.status === "PENDING" && day.timing === "TODAY"));

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className={cn("flex flex-wrap items-center gap-2 text-sm font-medium", item.removedAt ? "text-muted line-through" : "text-ink")}>
          {item.pharmacy.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Pill tone={status.tone}>{status.label}</Pill>
          {item.addedAfterLock ? <Pill tone="orange">Ditambah setelah terkunci</Pill> : null}
          {item.removedAt ? <span className="text-xs text-muted">dihapus {formatDateTime(item.removedAt)}</span> : null}
        </div>
        {item.visits.length > 0 ? (
          <p className="mt-1 text-xs text-muted">
            {item.visits.map(visitRange).join(" · ")} · {formatDuration(item.totalMinutes)}
          </p>
        ) : null}
        {item.missReason ? (
          <div className="mt-1.5 space-y-1">
            <p className="text-sm text-ink">“{item.missReason}”</p>
            {item.evidence ? <EvidenceLink evidence={item.evidence} /> : null}
          </div>
        ) : item.status === "MISSED" ? (
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-orange-600">
            <MessageSquareWarning className="size-3.5" /> Alasan belum diisi
          </p>
        ) : null}
      </div>
      {canExplain ? (
        <button type="button" onClick={() => onFillReason(item)} className={cn(buttonStyles.secondary, buttonStyles.small, "self-start")}>
          {item.missReason ? "Ubah alasan" : "Isi alasan"}
        </button>
      ) : null}
    </li>
  );
}

function DayCard({ day, onFillReason }: { day: PlanDay; onFillReason?: (item: PlanItem) => void }) {
  const empty = day.items.length === 0 && day.unplannedVisits.length === 0;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          {formatBusinessDate(day.date, { weekday: "long", day: "numeric", month: "short" })}
          {day.timing === "TODAY" ? <span className="ml-2 text-xs font-medium text-brand-600">Hari ini</span> : null}
        </p>
        {!empty ? (
          <p className="text-xs text-muted">
            {day.summary.visited}/{day.summary.planned} dikunjungi · {formatDuration(day.summary.totalMinutes)}
          </p>
        ) : null}
      </div>
      {empty ? (
        <p className="mt-2 text-sm text-subtle">Tidak ada rencana atau kunjungan.</p>
      ) : (
        <>
          <ul className="mt-1 divide-y divide-line">
            {day.items.map((item) => (
              <PlanItemRow key={item.id} item={item} day={day} onFillReason={onFillReason} />
            ))}
          </ul>
          {day.unplannedVisits.length > 0 ? (
            <div className="mt-2 rounded-xl bg-brand-50/60 px-3 py-2">
              <p className="text-xs font-semibold text-brand-700">Di luar rencana</p>
              <ul className="mt-1 space-y-1">
                {day.unplannedVisits.map((visit) => (
                  <li key={visit.id} className="flex flex-wrap justify-between gap-2 text-xs text-ink">
                    <span className="font-medium">{visit.pharmacy.name}</span>
                    <span className="text-muted">
                      {visitRange(visit)}
                      {visit.durationMin !== null ? ` · ${formatDuration(visit.durationMin)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

/**
 * KNJ-02: rencana vs kunjungan nyata per hari. `onFillReason` diisi hanya untuk Team Leader,
 * yang wajib memberi alasan untuk apotek rencana yang tidak dikunjungi.
 */
export function VisitEvaluationDays({ week, onFillReason }: { week: VisitPlanWeek; onFillReason?: (item: PlanItem) => void }) {
  const days = week.days.filter((day) => day.timing !== "FUTURE" || day.items.length > 0);

  if (!week.hasPlan && week.summary.visits === 0) {
    return (
      <Card>
        <EmptyState icon={CalendarRange}>Belum ada rencana atau kunjungan pada minggu ini.</EmptyState>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {days.map((day) => (
        <DayCard key={day.date} day={day} onFillReason={onFillReason} />
      ))}
    </div>
  );
}
