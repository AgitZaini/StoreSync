import { ExternalLink, MapPinned, Navigation } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Dialog, DialogActions } from "../../components/dialog";
import { TextInput } from "../../components/form-controls";
import { StoredImage } from "../../components/stored-image";
import { buttonStyles } from "../../components/styles";
import { Card, EmptyState, Field, Notice, PageHeader, Pill, Spinner } from "../../components/ui";
import type { PillTone } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { formatBusinessDate, formatDistance, formatDuration, formatTime, todayDate } from "../../lib/format";
import { openStreetMapUrl } from "../../lib/geo";
import { cn } from "../../lib/utils";
import type { LeaderPosition, LeaderVisit, VisitAttendance, WorkDayStatus } from "../../types/visits";
import LeaderMap from "./leader-map";
import { useLeaderPositions, useLeaderTrail } from "./visits-api";

const WORKDAY_STATUS: Record<WorkDayStatus, { label: string; tone: PillTone }> = {
  ACTIVE: { label: "Sedang bekerja", tone: "green" },
  ENDED: { label: "Selesai", tone: "gray" },
  NOT_STARTED: { label: "Belum mulai", tone: "blue" },
};

function LeaderCard({ row, selected, onSelect }: { row: LeaderPosition; selected: boolean; onSelect: () => void }) {
  const status = WORKDAY_STATUS[row.workDay.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition",
        selected ? "border-brand-300 bg-brand-50/60 ring-2 ring-brand-100" : "border-line bg-white hover:bg-canvas",
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{row.leader.name}</span>
          <span className="block truncate text-xs text-muted">{row.leader.team?.name ?? "Belum memimpin tim"}</span>
        </span>
        <Pill tone={status.tone}>{status.label}</Pill>
      </span>
      <span className="mt-2 block text-xs text-muted">
        {row.lastPing
          ? `Lokasi terakhir ${formatTime(row.lastPing.recordedAt)} WIB · ±${formatDistance(row.lastPing.accuracyM)}`
          : "Belum ada lokasi"}
      </span>
      <span className="mt-0.5 block text-xs text-muted">
        {row.visitCount} kunjungan · {formatDuration(row.totalMinutes)}
        {row.openVisit ? ` · di ${row.openVisit.pharmacy.name} sejak ${formatTime(row.openVisit.checkInAt)}` : ""}
      </span>
    </button>
  );
}

function Evidence({ label, record }: { label: string; record: VisitAttendance | null }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-subtle">{label}</p>
      {record ? (
        <>
          <StoredImage fileId={record.photoFileId} alt={`Foto ${label.toLowerCase()}`} className="aspect-[3/4] w-full rounded-xl" />
          <p className="mt-2 text-sm font-medium text-ink">{formatTime(record.serverAt)} WIB</p>
          <p className="text-xs text-muted">
            {formatDistance(record.distanceM)} dari apotek · akurasi ±{Math.round(record.accuracyM)} m
          </p>
          <a
            href={openStreetMapUrl(record.latitude, record.longitude)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
          >
            Lihat titik di peta <ExternalLink className="size-3" />
          </a>
        </>
      ) : (
        <div className="grid aspect-[3/4] w-full place-items-center rounded-xl border border-dashed border-line text-xs text-subtle">Belum ada</div>
      )}
    </div>
  );
}

function VisitDialog({ visit, onClose }: { visit: LeaderVisit; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} title={visit.pharmacy.name} description={visit.pharmacy.address} wide>
      <p className="text-sm text-muted">
        {visit.durationMin !== null ? `Lama kunjungan ${formatDuration(visit.durationMin)}` : "Belum absen keluar"}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Evidence label="Masuk" record={visit.checkIn} />
        <Evidence label="Keluar" record={visit.checkOut} />
      </div>
      <DialogActions>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Tutup
        </button>
      </DialogActions>
    </Dialog>
  );
}

/** ABS-03: Super Admin dan Admin melihat posisi terakhir dan jejak harian Team Leader di peta. */
export function LeaderMapPage() {
  const today = todayDate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDate = searchParams.get("tanggal");
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today;
  const live = date === today;
  const positions = useLeaderPositions(date, { live });
  const leaderId = searchParams.get("leader");
  const trail = useLeaderTrail(leaderId, date, { live });
  const [openVisit, setOpenVisit] = useState<LeaderVisit | null>(null);

  const update = (next: { tanggal?: string; leader?: string | null }) => {
    const params = new URLSearchParams(searchParams);
    if (next.tanggal !== undefined) params.set("tanggal", next.tanggal);
    if (next.leader !== undefined) {
      if (next.leader) params.set("leader", next.leader);
      else params.delete("leader");
    }
    setSearchParams(params, { replace: true });
  };

  const data = positions.data;
  const selected = data?.leaders.find((row) => row.leader.id === leaderId) ?? null;
  const trailData = trail.data && trail.data.leader.id === leaderId && trail.data.date === date ? trail.data : null;

  return (
    <>
      <PageHeader
        title="Peta Leader"
        description={live ? "Posisi terakhir Team Leader hari ini, diperbarui tiap menit." : `Jejak Team Leader pada ${formatBusinessDate(date, { weekday: "long", day: "numeric", month: "long" })}.`}
      />

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-end gap-2">
            <Field label="Tanggal">
              <TextInput type="date" value={date} max={today} onChange={(event) => update({ tanggal: event.target.value || today })} />
            </Field>
            {!live ? (
              <button type="button" onClick={() => update({ tanggal: today })} className={buttonStyles.secondary}>
                Hari ini
              </button>
            ) : null}
          </div>
          {data ? (
            <dl className="grid grid-cols-4 gap-2">
              {[
                { label: "Team Leader", value: data.summary.leaders, className: "text-ink" },
                { label: "Sedang bekerja", value: data.summary.active, className: "text-green-600" },
                { label: "Kunjungan", value: data.summary.visits, className: "text-brand-600" },
                { label: "Di apotek", value: data.summary.openVisits, className: "text-orange-600" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-canvas px-3 py-2 text-center">
                  <dd className={cn("text-lg font-semibold tabular-nums", item.className)}>{item.value}</dd>
                  <dt className="text-[11px] text-muted">{item.label}</dt>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        {data ? (
          <p className="mt-3 text-xs text-muted">
            Lokasi dikirim tiap 5 menit selama sesi kerja (absen masuk pertama sampai “Selesai hari ini” atau pukul {data.workEndTime} WIB), hanya
            saat aplikasi terbuka di HP leader.
          </p>
        ) : null}
      </Card>

      {!data ? (
        <div className="grid place-items-center py-16">
          {positions.error ? <Notice tone="red">{getErrorMessage(positions.error)}</Notice> : <Spinner />}
        </div>
      ) : data.leaders.length === 0 ? (
        <Card>
          <EmptyState icon={MapPinned}>Belum ada Team Leader.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <LeaderMap positions={data.leaders} trail={trailData} selectedId={leaderId} onSelect={(id) => update({ leader: id })} />

            {selected ? (
              <Card
                title={`Kunjungan ${selected.leader.name}`}
                action={trailData ? <span className="text-xs text-muted">{trailData.pings.length} titik lokasi</span> : null}
              >
                {!trailData ? (
                  <div className="grid place-items-center py-8">
                    {trail.error ? <Notice tone="red">{getErrorMessage(trail.error)}</Notice> : <Spinner />}
                  </div>
                ) : trailData.visits.length === 0 ? (
                  <EmptyState icon={Navigation}>Tidak ada kunjungan pada tanggal ini.</EmptyState>
                ) : (
                  <ol className="divide-y divide-line">
                    {trailData.visits.map((visit, index) => (
                      <li key={visit.id}>
                        <button type="button" onClick={() => setOpenVisit(visit)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:text-brand-600">
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-green-50 text-xs font-semibold text-green-700">{index + 1}</span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{visit.pharmacy.name}</span>
                              <span className="block text-xs text-muted">
                                {formatTime(visit.checkInAt)} – {visit.checkOutAt ? formatTime(visit.checkOutAt) : "belum keluar"} WIB
                              </span>
                            </span>
                          </span>
                          {visit.durationMin !== null ? (
                            <span className="shrink-0 text-xs font-medium tabular-nums text-ink">{formatDuration(visit.durationMin)}</span>
                          ) : (
                            <Pill tone="blue">{live ? "Berlangsung" : "Tanpa absen keluar"}</Pill>
                          )}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            ) : (
              <p className="text-center text-xs text-muted">Pilih leader untuk melihat jejak harian dan kunjungannya.</p>
            )}
          </div>
          <div className="min-w-0 space-y-3 xl:order-first">
            {selected ? (
              <button type="button" onClick={() => update({ leader: null })} className={cn(buttonStyles.ghost, buttonStyles.small)}>
                Tampilkan semua leader
              </button>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {data.leaders.map((row) => (
                <LeaderCard
                  key={row.leader.id}
                  row={row}
                  selected={row.leader.id === leaderId}
                  onSelect={() => update({ leader: row.leader.id === leaderId ? null : row.leader.id })}
                />
              ))}
            </div>
          </div>

        </div>
      )}

      {openVisit ? <VisitDialog visit={openVisit} onClose={() => setOpenVisit(null)} /> : null}
    </>
  );
}
