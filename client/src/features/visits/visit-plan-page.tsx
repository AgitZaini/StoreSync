import { useQueryClient } from "@tanstack/react-query";
import { Copy, Lock, LockOpen, Paperclip, Plus, Undo2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Dialog, DialogActions } from "../../components/dialog";
import { SelectInput, TextArea } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { Tabs } from "../../components/tabs";
import { useToast } from "../../components/toast-context";
import { Card, Field, Notice, PageHeader, Pill, Spinner } from "../../components/ui";
import { WeekNavigator } from "../../components/week-navigator";
import { api, getErrorMessage } from "../../lib/api";
import { formatBusinessDate, formatDateTime, mondayOf, shiftDate, todayDate } from "../../lib/format";
import { uploadFile } from "../../lib/upload";
import { cn } from "../../lib/utils";
import type { PharmacyBase } from "../../types/master-data";
import type { PlanDay, PlanItem, VisitPlanWeek } from "../../types/visits";
import { usePharmacies } from "../pharmacies/pharmacies-api";
import { EvidenceLink, PlanSummaryChips, VisitEvaluationDays } from "./visit-evaluation-days";
import { useSaveMissReason, useSaveVisitPlan, useVisitPlan } from "./visits-api";

type Draft = Record<string, string[]>;

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

const activeIds = (day: PlanDay) => day.items.filter((item) => !item.removedAt).map((item) => item.pharmacy.id);
const draftOf = (week: VisitPlanWeek): Draft => Object.fromEntries(week.days.map((day) => [day.date, activeIds(day)]));
/** Urutan apotek dalam sehari tidak disimpan, jadi draf dibandingkan sebagai himpunan. */
const sameList = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((id) => b.includes(id));

function LockInfo({ week }: { week: VisitPlanWeek }) {
  return week.isLocked ? (
    <p className="flex items-center gap-1.5 text-xs text-muted">
      <Lock className="size-3.5 text-orange-500" />
      Terkunci sejak {formatDateTime(week.lockedAt)}. Perubahan tetap bisa, tetapi ditandai dan dilaporkan ke Super Admin.
    </p>
  ) : (
    <p className="flex items-center gap-1.5 text-xs text-muted">
      <LockOpen className="size-3.5 text-green-600" />
      Bebas diubah sampai terkunci {formatDateTime(week.lockedAt)}.
    </p>
  );
}

function DayEditor({
  day,
  ids,
  editable,
  pharmacies,
  onChange,
}: {
  day: PlanDay;
  ids: string[];
  editable: boolean;
  pharmacies: PharmacyBase[];
  onChange: (ids: string[]) => void;
}) {
  const nameOf = (id: string) =>
    pharmacies.find((pharmacy) => pharmacy.id === id)?.name ?? day.items.find((item) => item.pharmacy.id === id)?.pharmacy.name ?? "Apotek";
  const itemFor = (id: string) => day.items.find((item) => item.pharmacy.id === id && !item.removedAt);
  const removed = day.items.filter((item) => item.removedAt && !ids.includes(item.pharmacy.id));
  const options = pharmacies.filter((pharmacy) => !ids.includes(pharmacy.id));

  return (
    <Card className={cn(day.timing === "TODAY" && "ring-2 ring-brand-200")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          {formatBusinessDate(day.date, { weekday: "long", day: "numeric", month: "short" })}
          {day.timing === "TODAY" ? <span className="ml-2 text-xs font-medium text-brand-600">Hari ini</span> : null}
        </p>
        <span className="text-xs text-muted">{ids.length} apotek</span>
      </div>

      {ids.length === 0 ? <p className="mt-3 text-sm text-subtle">{editable ? "Belum ada apotek." : "Tidak ada rencana."}</p> : null}
      <ul className="mt-2 space-y-1.5">
        {ids.map((id) => {
          const item = itemFor(id);
          return (
            <li key={id} className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{nameOf(id)}</span>
                <span className="flex flex-wrap gap-1">
                  {!item ? <span className="text-[11px] text-brand-600">Belum disimpan</span> : null}
                  {item?.addedAfterLock ? <span className="text-[11px] text-orange-600">Ditambah setelah terkunci</span> : null}
                  {item?.status === "VISITED" ? <span className="text-[11px] text-green-600">Dikunjungi</span> : null}
                </span>
              </span>
              {editable ? (
                <button
                  type="button"
                  onClick={() => onChange(ids.filter((current) => current !== id))}
                  className="grid size-7 shrink-0 place-items-center rounded-lg text-subtle hover:bg-white hover:text-red-600"
                  aria-label={`Hapus ${nameOf(id)}`}
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </li>
          );
        })}
        {removed.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-1 text-xs text-muted">
            <span className="truncate line-through">{item.pharmacy.name}</span>
            <span className="shrink-0">dihapus setelah terkunci</span>
          </li>
        ))}
      </ul>

      {editable ? (
        <div className="mt-3">
          <SelectInput
            value=""
            onChange={(event) => event.target.value && onChange([...ids, event.target.value])}
            aria-label={`Tambah apotek ${formatBusinessDate(day.date)}`}
            disabled={options.length === 0}
          >
            <option value="">+ Tambah apotek</option>
            {options.map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>
                {pharmacy.name}
              </option>
            ))}
          </SelectInput>
        </div>
      ) : null}
    </Card>
  );
}

function PlanEditor({
  week,
  loading,
  draft,
  onDraftChange,
  onReset,
}: {
  week: VisitPlanWeek;
  loading: boolean;
  draft: Draft;
  onDraftChange: (draft: Draft) => void;
  onReset: () => void;
}) {
  const queryClient = useQueryClient();
  const pharmacies = usePharmacies({ status: "ACTIVE" });
  const savePlan = useSaveVisitPlan(week.weekStart);
  const showToast = useToast();
  const original = useMemo(() => draftOf(week), [week]);
  const editableDate = (date: string) => week.editable && date >= week.today && !loading;
  const changedDates = week.dates.filter((date) => editableDate(date) && !sameList(draft[date], original[date]));
  const editableDates = week.dates.filter(editableDate);

  const copyLastWeek = async () => {
    const previousWeek = shiftDate(week.weekStart, -7);
    const previous = await queryClient.fetchQuery({
      queryKey: ["visit-plan", previousWeek, "self"],
      queryFn: async () => (await api.get<VisitPlanWeek>("/visit-plans", { params: { weekStart: previousWeek } })).data,
    });
    const activePharmacyIds = new Set((pharmacies.data ?? []).map((pharmacy) => pharmacy.id));
    let filled = 0;
    const next = { ...draft };
    previous.days.forEach((day, index) => {
      const date = week.dates[index];
      const ids = activeIds(day).filter((id) => activePharmacyIds.has(id));
      if (editableDate(date) && (next[date] ?? []).length === 0 && ids.length > 0) {
        next[date] = ids;
        filled += 1;
      }
    });
    onDraftChange(next);
    showToast(filled > 0 ? `${filled} hari disalin dari minggu lalu. Periksa lalu simpan.` : "Tidak ada hari kosong yang bisa diisi dari minggu lalu.");
  };

  const save = () =>
    savePlan.mutate(
      changedDates.map((date) => ({ date, pharmacyIds: draft[date] ?? [] })),
      {
        onSuccess: (saved) =>
          showToast(saved.isLocked ? "Rencana disimpan. Perubahan ditandai karena rencana sudah terkunci." : "Rencana kunjungan disimpan"),
      },
    );

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <LockInfo week={week} />
          {week.editable ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void copyLastWeek()} disabled={editableDates.length === 0 || loading} className={cn(buttonStyles.secondary, buttonStyles.small)}>
                <Copy />
                Salin minggu lalu
              </button>
              <button type="button" onClick={onReset} disabled={changedDates.length === 0} className={cn(buttonStyles.ghost, buttonStyles.small)}>
                <Undo2 />
                Batalkan
              </button>
              <button type="button" onClick={save} disabled={changedDates.length === 0 || savePlan.isPending} className={cn(buttonStyles.primary, buttonStyles.small)}>
                {savePlan.isPending ? "Menyimpan..." : changedDates.length > 0 ? `Simpan (${changedDates.length} hari)` : "Simpan"}
              </button>
            </div>
          ) : (
            <Pill tone="gray">Hanya lihat</Pill>
          )}
        </div>
        {savePlan.error ? (
          <div className="mt-3">
            <Notice tone="red">{getErrorMessage(savePlan.error)}</Notice>
          </div>
        ) : null}
        {!week.editable ? (
          <p className="mt-2 text-xs text-muted">Rencana hanya bisa disusun untuk minggu ini sampai 4 minggu ke depan.</p>
        ) : null}
      </Card>

      {!pharmacies.data ? (
        <div className="grid place-items-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {week.days.map((day) => (
            <DayEditor
              key={day.date}
              day={day}
              ids={draft[day.date] ?? []}
              editable={editableDate(day.date)}
              pharmacies={pharmacies.data}
              onChange={(ids) => onDraftChange({ ...draft, [day.date]: ids })}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ReasonDialog({ item, onClose }: { item: PlanItem; onClose: () => void }) {
  const saveReason = useSaveMissReason();
  const showToast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState(item.missReason ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeEvidence, setRemoveEvidence] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = uploading || saveReason.isPending;

  const pickFile = (picked: File | undefined) => {
    setError(null);
    if (!picked) return;
    if (!picked.type.startsWith("image/") && picked.type !== "application/pdf") {
      setError("Bukti harus berupa foto atau PDF.");
      return;
    }
    if (picked.size > MAX_EVIDENCE_BYTES) {
      setError("Ukuran bukti maksimal 10 MB.");
      return;
    }
    setFile(picked);
    setRemoveEvidence(false);
  };

  const submit = async () => {
    setError(null);
    let evidenceFileId: string | null | undefined;

    try {
      if (file) {
        setUploading(true);
        evidenceFileId = (await uploadFile(file, "VISIT_EVIDENCE")).id;
      } else if (removeEvidence) {
        evidenceFileId = null;
      }
      await saveReason.mutateAsync({ itemId: item.id, reason: reason.trim(), evidenceFileId });
      showToast("Alasan disimpan");
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Bukti gagal diunggah. Periksa koneksi lalu coba lagi."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title="Alasan tidak dikunjungi" description={`${item.pharmacy.name} · ${formatBusinessDate(item.date, { weekday: "long", day: "numeric", month: "long" })}`}>
      <div className="space-y-4">
        <Field label="Alasan" hint="Wajib, minimal 5 karakter. Tercatat di riwayat.">
          <TextArea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Contoh: sakit, ada surat dokter" />
        </Field>
        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium text-gray-700">Bukti (opsional)</span>
          {item.evidence && !removeEvidence && !file ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2">
              <EvidenceLink evidence={item.evidence} />
              <button type="button" onClick={() => setRemoveEvidence(true)} className={cn(buttonStyles.ghost, buttonStyles.small)}>
                Lepas
              </button>
            </div>
          ) : null}
          {file ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2 text-sm">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Paperclip className="size-4 shrink-0 text-brand-500" />
                <span className="truncate">{file.name}</span>
              </span>
              <button type="button" onClick={() => setFile(null)} className={cn(buttonStyles.ghost, buttonStyles.small)}>
                Batal
              </button>
            </div>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(event) => {
              pickFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button type="button" onClick={() => fileInput.current?.click()} className={cn(buttonStyles.secondary, "w-full sm:w-auto")}>
            <Plus />
            {item.evidence || file ? "Ganti bukti" : "Lampirkan foto/PDF"}
          </button>
          <span className="text-xs text-muted">Misalnya surat dokter. Foto atau PDF, maksimal 10 MB.</span>
        </div>
        {error ? <Notice tone="red">{error}</Notice> : null}
      </div>
      <DialogActions>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Batal
        </button>
        <button type="button" disabled={reason.trim().length < 5 || pending} onClick={() => void submit()} className={buttonStyles.primary}>
          {uploading ? "Mengunggah bukti..." : saveReason.isPending ? "Menyimpan..." : "Simpan alasan"}
        </button>
      </DialogActions>
    </Dialog>
  );
}

/** KNJ-01 (susun rencana mingguan) dan KNJ-02 (alasan apotek yang tidak dikunjungi) untuk Team Leader. */
export function VisitPlanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "evaluasi" ? "evaluation" : "plan";
  const requestedWeek = searchParams.get("minggu");
  const [weekStartState, setWeekStartState] = useState(() =>
    requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek) ? mondayOf(requestedWeek) : mondayOf(todayDate()),
  );
  const week = useVisitPlan(weekStartState);
  const [edits, setEdits] = useState<{ key: string; draft: Draft } | null>(null);
  const [explaining, setExplaining] = useState<PlanItem | null>(null);

  // Draf direset otomatis saat minggu atau versi rencana di server berubah (mis. setelah disimpan).
  const data = week.data && !week.isPlaceholderData ? week.data : undefined;
  const draftKey = data ? `${data.weekStart}:${data.updatedAt ?? "baru"}` : "";
  const original = useMemo(() => (data ? draftOf(data) : {}), [data]);
  const draft = edits && edits.key === draftKey ? edits.draft : original;
  const dirtyCount = data ? data.dates.filter((date) => !sameList(draft[date], original[date])).length : 0;

  const setWeekStart = (next: string) => {
    if (dirtyCount > 0 && !window.confirm(`${dirtyCount} hari rencana belum disimpan dan akan hilang. Lanjutkan?`)) return;
    setEdits(null);
    setWeekStartState(next);
  };

  const shown = week.data;

  return (
    <>
      <PageHeader title="Rencana Kunjungan" description="Daftar apotek yang akan dikunjungi per hari. Terkunci mulai Senin 00.00 WIB." />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[
            { key: "plan", label: "Rencana" },
            { key: "evaluation", label: "Evaluasi", count: shown?.summary.missingReason || undefined },
          ]}
          value={tab}
          onChange={(key) => setSearchParams(key === "evaluation" ? { tab: "evaluasi" } : {}, { replace: true })}
        />
        <WeekNavigator weekStart={weekStartState} onChange={setWeekStart} />
      </div>

      {!shown ? (
        <div className="grid place-items-center py-16">
          {week.error ? <Notice tone="red">{getErrorMessage(week.error)}</Notice> : <Spinner />}
        </div>
      ) : tab === "plan" ? (
        <PlanEditor
          week={shown}
          loading={week.isPlaceholderData}
          draft={data ? draft : draftOf(shown)}
          onDraftChange={(next) => setEdits({ key: draftKey, draft: next })}
          onReset={() => setEdits(null)}
        />
      ) : (
        <>
          <Card>
            <PlanSummaryChips summary={shown.summary} />
            {shown.summary.missingReason > 0 ? (
              <p className="mt-3 text-sm text-orange-700">
                {shown.summary.missingReason} apotek rencana tidak dikunjungi. Isi alasannya; bukti (mis. surat dokter) boleh dilampirkan.
              </p>
            ) : null}
          </Card>
          <VisitEvaluationDays week={shown} onFillReason={setExplaining} />
        </>
      )}

      {explaining ? <ReasonDialog item={explaining} onClose={() => setExplaining(null)} /> : null}
    </>
  );
}
