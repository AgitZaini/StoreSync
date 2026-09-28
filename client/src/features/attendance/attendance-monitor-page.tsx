import { CheckCircle2, ClipboardCheck, ExternalLink, MessageSquareText, UserCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { Dialog, DialogActions } from "../../components/dialog";
import { TextArea, TextInput } from "../../components/form-controls";
import { StoredImage } from "../../components/stored-image";
import { buttonStyles } from "../../components/styles";
import { Tabs } from "../../components/tabs";
import { useToast } from "../../components/toast-context";
import { Card, DataTable, EmptyState, Field, Notice, PageHeader, Pill, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { formatBusinessDate, formatDateTime, formatDistance, formatScheduleValue, formatTime, shiftDate, todayDate } from "../../lib/format";
import { openStreetMapUrl } from "../../lib/geo";
import { cn } from "../../lib/utils";
import type { AttendanceException, MonitorAttendance, MonitorRow, MonitorSummary } from "../../types/attendance";
import { useCurrentUser } from "../auth/auth-context";
import {
  useAttendanceExceptions,
  useAttendanceMonitor,
  useReviewException,
  useSaveAttendanceNote,
} from "./attendance-api";
import { AttendanceStatusPill } from "./attendance-status-pill";

const SUMMARY_ITEMS: Array<{ key: keyof MonitorSummary; label: string; className: string }> = [
  { key: "scheduled", label: "Terjadwal", className: "text-ink" },
  { key: "onTime", label: "Tepat waktu", className: "text-green-600" },
  { key: "late", label: "Telat", className: "text-orange-600" },
  { key: "notCheckedIn", label: "Belum absen", className: "text-red-600" },
  { key: "absent", label: "Tidak masuk", className: "text-red-600" },
  { key: "off", label: "Libur", className: "text-violet-600" },
  { key: "unscheduled", label: "Tanpa jadwal", className: "text-brand-600" },
];

function AttendanceCell({ record }: { record: MonitorAttendance | null }) {
  if (!record) return <span className="text-subtle">-</span>;

  return (
    <span className="block">
      <span className="font-medium text-ink">{formatTime(record.serverAt)}</span>
      <span className="block text-xs text-muted">
        {formatDistance(record.distanceM)} · ±{Math.round(record.accuracyM)} m
      </span>
      {record.viaException ? <Pill tone="blue" className="mt-1">Pengecualian</Pill> : null}
    </span>
  );
}

function AttendanceEvidence({ label, record }: { label: string; record: MonitorAttendance | null }) {
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
        <div className="grid aspect-[3/4] w-full place-items-center rounded-xl border border-dashed border-line text-xs text-subtle">
          Belum ada
        </div>
      )}
    </div>
  );
}

export function RowDetailDialog({ row, date, canEdit, onClose }: { row: MonitorRow; date: string; canEdit: boolean; onClose: () => void }) {
  const saveNote = useSaveAttendanceNote();
  const showToast = useToast();
  const [note, setNote] = useState(row.note ?? "");

  return (
    <Dialog open onClose={onClose} title={row.spg.name} description={`${row.pharmacy.name} · ${formatBusinessDate(date, { weekday: "long", day: "numeric", month: "long" })}`} wide>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <AttendanceStatusPill status={row.status} lateMinutes={row.lateMinutes} />
        <span className="text-muted">Jadwal: {row.schedule ? formatScheduleValue(row.schedule) : "tidak ada"}</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <AttendanceEvidence label="Masuk" record={row.checkIn} />
        <AttendanceEvidence label="Pulang" record={row.checkOut} />
      </div>
      <div className="mt-6">
        {canEdit ? (
          <Field label="Catatan Admin" hint="Alasan telat atau tidak masuk. Tidak ada potongan otomatis (AB-04).">
            <TextArea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
          </Field>
        ) : row.note ? (
          <Notice>{row.note}</Notice>
        ) : null}
        {saveNote.error ? (
          <div className="mt-3">
            <Notice tone="red">{getErrorMessage(saveNote.error)}</Notice>
          </div>
        ) : null}
      </div>
      <DialogActions>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Tutup
        </button>
        {canEdit ? (
          <button
            type="button"
            disabled={note.trim() === (row.note ?? "") || saveNote.isPending}
            onClick={() =>
              saveNote.mutate(
                { spgId: row.spg.id, pharmacyId: row.pharmacy.id, date, note: note.trim() },
                {
                  onSuccess: () => {
                    showToast("Catatan disimpan");
                    onClose();
                  },
                },
              )
            }
            className={buttonStyles.primary}
          >
            {saveNote.isPending ? "Menyimpan..." : "Simpan catatan"}
          </button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

function DailyPanel({ canEdit }: { canEdit: boolean }) {
  const today = todayDate();
  const [date, setDate] = useState(today);
  const monitor = useAttendanceMonitor(date, { live: date === today });
  const [selected, setSelected] = useState<MonitorRow | null>(null);

  return (
    <>
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-end gap-2">
            <Field label="Tanggal">
              <TextInput type="date" value={date} max={shiftDate(today, 1)} onChange={(event) => setDate(event.target.value || today)} />
            </Field>
            {date !== today ? (
              <button type="button" onClick={() => setDate(today)} className={buttonStyles.secondary}>
                Hari ini
              </button>
            ) : null}
          </div>
          {monitor.data ? (
            <dl className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {SUMMARY_ITEMS.map((item) => (
                <div key={item.key} className="rounded-xl bg-canvas px-3 py-2 text-center">
                  <dd className={cn("text-lg font-semibold tabular-nums", item.className)}>{monitor.data.summary[item.key]}</dd>
                  <dt className="text-[11px] text-muted">{item.label}</dt>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </Card>

      <Card>
        {!monitor.data ? (
          <div className="grid place-items-center py-12">
            {monitor.error ? <Notice tone="red">{getErrorMessage(monitor.error)}</Notice> : <Spinner />}
          </div>
        ) : monitor.data.rows.length === 0 ? (
          <EmptyState icon={UserCheck}>Tidak ada jadwal atau absen pada tanggal ini.</EmptyState>
        ) : (
          <DataTable
            minWidth="min-w-[900px]"
            headers={["SPG", "Apotek", "Jadwal", "Status", "Masuk", "Pulang", "Catatan"]}
            rows={monitor.data.rows.map((row) => [
              <button key="spg" type="button" onClick={() => setSelected(row)} className="block text-left hover:text-brand-600">
                <span className="block font-medium">{row.spg.name}</span>
                <span className="block text-xs font-normal text-muted">{row.spg.team?.name ?? "Tanpa tim"}</span>
              </button>,
              row.pharmacy.name,
              row.schedule ? formatScheduleValue(row.schedule) : "-",
              <span key="status" className="flex flex-col items-start gap-1">
                <AttendanceStatusPill status={row.status} lateMinutes={row.lateMinutes} />
                {row.pendingExceptions > 0 ? <Pill tone="blue">{row.pendingExceptions} pengecualian</Pill> : null}
              </span>,
              <AttendanceCell key="in" record={row.checkIn} />,
              <AttendanceCell key="out" record={row.checkOut} />,
              <button
                key="note"
                type="button"
                onClick={() => setSelected(row)}
                className={cn("inline-flex max-w-[180px] items-center gap-1.5 text-left text-xs", row.note ? "text-ink" : "text-brand-600")}
              >
                <MessageSquareText className="size-3.5 shrink-0" />
                <span className="truncate">{row.note ?? (canEdit ? "Tambah catatan" : "Detail")}</span>
              </button>,
            ])}
          />
        )}
      </Card>

      {selected && monitor.data ? (
        <RowDetailDialog row={selected} date={monitor.data.date} canEdit={canEdit} onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}

const KIND_LABEL = { CHECK_IN: "Absen masuk", CHECK_OUT: "Absen pulang" } as const;

function ExceptionCard({ exception, canReview }: { exception: AttendanceException; canReview: boolean }) {
  const review = useReviewException();
  const showToast = useToast();
  const [rejecting, setRejecting] = useState(false);
  const pending = exception.status === "PENDING";

  return (
    <Card>
      <div className="flex gap-4">
        <StoredImage fileId={exception.photoFileId} alt={`Foto ${exception.user.name}`} className="h-32 w-24 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{exception.user.name}</p>
              <p className="text-xs text-muted">
                {KIND_LABEL[exception.kind]} · {exception.pharmacy.name}
              </p>
            </div>
            {pending ? (
              <Pill tone="orange">Menunggu</Pill>
            ) : exception.status === "APPROVED" ? (
              <Pill tone="green">Disetujui</Pill>
            ) : (
              <Pill tone="red">Ditolak</Pill>
            )}
          </div>
          <p className="mt-2 text-sm text-ink">“{exception.reason}”</p>
          <p className="mt-2 text-xs text-muted">
            {formatDateTime(exception.requestedAt)} · {formatDistance(exception.distanceM)} dari apotek (radius {exception.pharmacy.radiusM} m) · akurasi ±
            {Math.round(exception.accuracyM)} m
            {exception.faceCheck && !exception.faceCheck.passed ? " · verifikasi wajah tidak berjalan" : ""}
          </p>
          <a
            href={openStreetMapUrl(exception.latitude, exception.longitude)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
          >
            Lihat titik di peta <ExternalLink className="size-3" />
          </a>
          {exception.reviewNote ? <p className="mt-2 text-xs text-muted">Catatan Admin: {exception.reviewNote}</p> : null}

          {pending && canReview ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={review.isPending}
                onClick={() =>
                  review.mutate(
                    { id: exception.id, decision: "approve" },
                    { onSuccess: () => showToast(`Absen ${exception.user.name} dicatat`), onError: (error) => showToast(getErrorMessage(error), "error") },
                  )
                }
                className={cn(buttonStyles.primary, buttonStyles.small)}
              >
                <CheckCircle2 />
                Setujui
              </button>
              <button type="button" onClick={() => setRejecting(true)} className={cn(buttonStyles.danger, buttonStyles.small)}>
                <XCircle />
                Tolak
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <ConfirmDialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Tolak pengecualian absen"
        message={`${exception.user.name} akan menerima notifikasi berisi alasan penolakan dan bisa mencoba absen lagi.`}
        reasonLabel="Alasan penolakan"
        confirmLabel="Tolak"
        tone="danger"
        onConfirm={async (note) => {
          await review.mutateAsync({ id: exception.id, decision: "reject", note });
          showToast("Pengecualian ditolak");
        }}
      />
    </Card>
  );
}

function ExceptionsPanel({ canReview }: { canReview: boolean }) {
  const exceptions = useAttendanceExceptions();
  const items = exceptions.data ?? [];
  const pending = items.filter((item) => item.status === "PENDING");
  const processed = items.filter((item) => item.status !== "PENDING");

  if (!exceptions.data) {
    return (
      <div className="grid place-items-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {pending.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardCheck}>Tidak ada pengecualian absen yang menunggu.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pending.map((exception) => (
            <ExceptionCard key={exception.id} exception={exception} canReview={canReview} />
          ))}
        </div>
      )}
      {processed.length > 0 ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-subtle">Sudah diproses</p>
          <div className="grid gap-4 xl:grid-cols-2">
            {processed.slice(0, 20).map((exception) => (
              <ExceptionCard key={exception.id} exception={exception} canReview={false} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** ABS-04: pemantauan absen dibanding jadwal, plus persetujuan pengecualian absen. */
export function AttendanceMonitorPage() {
  const user = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "pengecualian" ? "exceptions" : "daily";
  const pendingCount = useAttendanceExceptions("PENDING").data?.length;
  const isAdmin = user.role === "ADMIN";

  return (
    <>
      <PageHeader title="Pemantauan Absen" description="Absen SPG dibanding jadwal. Jam absen dicatat apa adanya; tindak lanjut oleh Admin." />
      <Tabs
        tabs={[
          { key: "daily", label: "Absen harian" },
          { key: "exceptions", label: "Pengecualian", count: pendingCount },
        ]}
        value={tab}
        onChange={(key) => setSearchParams(key === "exceptions" ? { tab: "pengecualian" } : {}, { replace: true })}
      />
      {tab === "daily" ? <DailyPanel canEdit={isAdmin} /> : <ExceptionsPanel canReview={isAdmin} />}
    </>
  );
}
