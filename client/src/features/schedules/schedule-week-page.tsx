import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Copy, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogActions } from "../../components/dialog";
import { SelectInput, TextInput } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { useToast } from "../../components/toast-context";
import { Card, EmptyState, Field, Notice, PageHeader, Spinner } from "../../components/ui";
import { WeekNavigator } from "../../components/week-navigator";
import { getErrorMessage } from "../../lib/api";
import { formatBusinessDate, formatScheduleValue, mondayOf, shiftDate, todayDate } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { ScheduleRow, ScheduleValue, ScheduleWeek } from "../../types/attendance";
import { usePharmacies } from "../pharmacies/pharmacies-api";
import { useTeams } from "../users/users-api";
import { scheduleWeekQuery, useSaveScheduleWeek, useScheduleWeek } from "./schedules-api";
import type { ScheduleFilters } from "./schedules-api";

type Draft = Record<string, ScheduleValue | null>;

const cellKey = (row: ScheduleRow, date: string) => `${row.spg.id}:${row.pharmacy.id}:${date}`;
const sameValue = (a: ScheduleValue | null | undefined, b: ScheduleValue | null | undefined) =>
  (a ?? null) === (b ?? null) ||
  (Boolean(a) && Boolean(b) && a!.isOff === b!.isOff && a!.startTime === b!.startTime && a!.endTime === b!.endTime);

type Editing = { row: ScheduleRow; date: string };

function CellEditor({
  editing,
  current,
  onApply,
  onClose,
}: {
  editing: Editing;
  current: ScheduleValue | null;
  onApply: (dates: string[], value: ScheduleValue | null) => void;
  onClose: () => void;
}) {
  const { row, date } = editing;
  const [mode, setMode] = useState<"shift" | "off" | "clear">(current ? (current.isOff ? "off" : "shift") : "shift");
  const [startTime, setStartTime] = useState(current?.startTime ?? row.pharmacy.openTime ?? "08:00");
  const [endTime, setEndTime] = useState(current?.endTime ?? "16:00");
  const [alsoDates, setAlsoDates] = useState<string[]>([]);
  const invalid = mode === "shift" && (!startTime || !endTime || startTime === endTime);

  const value: ScheduleValue | null =
    mode === "clear" ? null : mode === "off" ? { isOff: true, startTime: null, endTime: null } : { isOff: false, startTime, endTime };

  return (
    <Dialog open onClose={onClose} title={`${row.spg.name} · ${row.pharmacy.name}`} description={formatBusinessDate(date, { weekday: "long", day: "numeric", month: "long" })}>
      <div className="space-y-5">
        <div role="radiogroup" aria-label="Jenis jadwal" className="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1">
          {(
            [
              ["shift", "Masuk"],
              ["off", "Libur"],
              ["clear", "Kosongkan"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={mode === key}
              onClick={() => setMode(key)}
              className={cn("h-9 rounded-lg text-sm font-medium transition", mode === key ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink")}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "shift" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jam masuk">
              <TextInput type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} invalid={invalid} />
            </Field>
            <Field label="Jam pulang" hint={endTime && startTime && endTime < startTime ? "Selesai keesokan hari" : undefined}>
              <TextInput type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} invalid={invalid} />
            </Field>
          </div>
        ) : null}

        {row.availableDates.length > 1 ? (
          <div className="grid gap-2">
            <span className="text-[13px] font-medium text-gray-700">Terapkan juga ke</span>
            <div className="flex flex-wrap gap-1.5">
              {row.availableDates
                .filter((candidate) => candidate !== date)
                .map((candidate) => {
                  const selected = alsoDates.includes(candidate);
                  return (
                    <button
                      key={candidate}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setAlsoDates((current) => (selected ? current.filter((item) => item !== candidate) : [...current, candidate]))
                      }
                      className={cn(
                        "h-8 rounded-lg px-2.5 text-xs font-medium transition",
                        selected ? "bg-brand-600 text-white" : "bg-canvas text-gray-600 hover:text-ink",
                      )}
                    >
                      {formatBusinessDate(candidate, { weekday: "short" })}
                    </button>
                  );
                })}
            </div>
          </div>
        ) : null}
      </div>
      <DialogActions>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Batal
        </button>
        <button
          type="button"
          disabled={invalid}
          onClick={() => {
            onApply([date, ...alsoDates], value);
            onClose();
          }}
          className={buttonStyles.primary}
        >
          Terapkan{alsoDates.length > 0 ? ` ke ${alsoDates.length + 1} hari` : ""}
        </button>
      </DialogActions>
    </Dialog>
  );
}

function ScheduleGrid({
  week,
  filters,
  onDirtyChange,
}: {
  week: ScheduleWeek;
  filters: ScheduleFilters;
  onDirtyChange: (count: number) => void;
}) {
  const queryClient = useQueryClient();
  const saveWeek = useSaveScheduleWeek(week.weekStart);
  const showToast = useToast();
  const [draft, setDraft] = useState<Draft>({});
  const [editing, setEditing] = useState<Editing | null>(null);
  const [copying, setCopying] = useState(false);
  const today = todayDate();

  const original = (row: ScheduleRow, date: string) => row.entries[date] ?? null;
  const effective = (row: ScheduleRow, date: string) => {
    const key = cellKey(row, date);
    return key in draft ? draft[key] : original(row, date);
  };
  const changes = week.rows.flatMap((row) =>
    week.dates
      .filter((date) => cellKey(row, date) in draft && !sameValue(draft[cellKey(row, date)], original(row, date)))
      .map((date) => ({ spgId: row.spg.id, pharmacyId: row.pharmacy.id, date, value: draft[cellKey(row, date)] })),
  );

  useEffect(() => onDirtyChange(changes.length), [changes.length, onDirtyChange]);

  const apply = (row: ScheduleRow, dates: string[], value: ScheduleValue | null) =>
    setDraft((current) => ({ ...current, ...Object.fromEntries(dates.map((date) => [cellKey(row, date), value])) }));

  /** Mengisi sel kosong minggu ini dengan jadwal di hari yang sama minggu lalu. */
  const copyPreviousWeek = async () => {
    setCopying(true);
    try {
      const previous = await queryClient.fetchQuery(scheduleWeekQuery(shiftDate(week.weekStart, -7), filters));
      const next: Draft = {};

      for (const row of week.rows) {
        const previousRow = previous.rows.find((item) => item.spg.id === row.spg.id && item.pharmacy.id === row.pharmacy.id);
        week.dates.forEach((date, index) => {
          const value = previousRow?.entries[previous.dates[index]];
          if (value && row.availableDates.includes(date) && !effective(row, date)) {
            next[cellKey(row, date)] = { isOff: value.isOff, startTime: value.startTime, endTime: value.endTime };
          }
        });
      }

      setDraft((current) => ({ ...current, ...next }));
      showToast(Object.keys(next).length > 0 ? `${Object.keys(next).length} jadwal disalin dari minggu lalu` : "Tidak ada jadwal minggu lalu untuk disalin");
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    } finally {
      setCopying(false);
    }
  };

  if (week.rows.length === 0) {
    return (
      <Card>
        <EmptyState icon={CalendarDays}>Belum ada SPG yang ditempatkan untuk filter ini.</EmptyState>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Klik sel untuk mengisi jam masuk/pulang atau libur.
          {changes.length > 0 ? <span className="font-medium text-orange-600"> {changes.length} perubahan belum disimpan.</span> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copyPreviousWeek()} disabled={copying} className={buttonStyles.secondary}>
            <Copy />
            Salin minggu lalu
          </button>
          {changes.length > 0 ? (
            <button type="button" onClick={() => setDraft({})} className={buttonStyles.secondary}>
              <Undo2 />
              Batalkan
            </button>
          ) : null}
          <button
            type="button"
            disabled={changes.length === 0 || saveWeek.isPending}
            onClick={() =>
              saveWeek.mutate(changes, {
                onSuccess: () => showToast(`${changes.length} jadwal disimpan; SPG terkait mendapat notifikasi`),
              })
            }
            className={buttonStyles.primary}
          >
            {saveWeek.isPending ? "Menyimpan..." : `Simpan${changes.length > 0 ? ` (${changes.length})` : ""}`}
          </button>
        </div>
      </div>
      {saveWeek.error ? (
        <div className="mb-4">
          <Notice tone="red">{getErrorMessage(saveWeek.error)}</Notice>
        </div>
      ) : null}

      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[880px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white pb-3 pr-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">
                SPG · Apotek
              </th>
              {week.dates.map((date) => (
                <th
                  key={date}
                  className={cn("pb-3 text-center text-[11px] font-semibold uppercase tracking-[0.06em]", date === today ? "text-brand-600" : "text-subtle")}
                >
                  {formatBusinessDate(date, { weekday: "short", day: "numeric", month: "numeric" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.rows.map((row) => (
              <tr key={`${row.spg.id}:${row.pharmacy.id}`}>
                <td className="sticky left-0 z-10 max-w-[220px] border-t border-line bg-white py-2 pr-4 align-middle">
                  <span className="block truncate font-medium text-ink">{row.spg.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {row.pharmacy.name}
                    {row.spg.team ? ` · ${row.spg.team.name}` : ""}
                  </span>
                </td>
                {week.dates.map((date) => {
                  const available = row.availableDates.includes(date);
                  const value = effective(row, date);
                  const dirty = cellKey(row, date) in draft && !sameValue(draft[cellKey(row, date)], original(row, date));

                  return (
                    <td key={date} className="border-t border-line px-1 py-2 text-center">
                      <button
                        type="button"
                        disabled={!available && !value}
                        onClick={() => setEditing({ row, date })}
                        title={available ? undefined : "SPG tidak ditempatkan di apotek ini pada tanggal ini"}
                        className={cn(
                          "h-11 w-full min-w-[96px] rounded-xl text-xs font-medium tabular-nums transition",
                          !available && !value
                            ? "cursor-not-allowed bg-gray-50 text-gray-300"
                            : value?.isOff
                              ? "bg-violet-50 text-violet-700 hover:bg-violet-100"
                              : value
                                ? "bg-brand-50 text-brand-700 hover:bg-brand-100"
                                : "border border-dashed border-line text-subtle hover:border-brand-300 hover:text-brand-600",
                          dirty && "ring-2 ring-orange-300",
                        )}
                      >
                        {value ? formatScheduleValue(value) : available ? "+" : "—"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <CellEditor
          editing={editing}
          current={effective(editing.row, editing.date)}
          onApply={(dates, value) => apply(editing.row, dates, value)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Card>
  );
}

/** JDW-01: Admin mengisi jadwal mingguan SPG per apotek; setiap perubahan tercatat di riwayat. */
export function ScheduleWeekPage() {
  const [weekStart, setWeekStartState] = useState(() => mondayOf(todayDate()));
  const [filters, setFiltersState] = useState<ScheduleFilters>({});
  const [dirtyCount, setDirtyCount] = useState(0);
  const confirmDiscard = () =>
    dirtyCount === 0 || window.confirm(`${dirtyCount} perubahan jadwal belum disimpan dan akan hilang. Lanjutkan?`);
  const setWeekStart = (next: string) => confirmDiscard() && setWeekStartState(next);
  const setFilters = (update: (current: ScheduleFilters) => ScheduleFilters) => confirmDiscard() && setFiltersState(update);
  const week = useScheduleWeek(weekStart, filters);
  const teams = useTeams();
  const pharmacies = usePharmacies({ status: "ACTIVE" });
  return (
    <>
      <PageHeader title="Jadwal Mingguan" description="Jadwal SPG per apotek, sesuai yang ditentukan pihak apotek." />

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <WeekNavigator weekStart={weekStart} onChange={setWeekStart} />
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[440px]">
            <SelectInput
              value={filters.teamId ?? ""}
              onChange={(event) => setFilters((current) => ({ ...current, teamId: event.target.value || undefined }))}
              aria-label="Filter tim"
            >
              <option value="">Semua tim</option>
              {(teams.data ?? []).map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </SelectInput>
            <SelectInput
              value={filters.pharmacyId ?? ""}
              onChange={(event) => setFilters((current) => ({ ...current, pharmacyId: event.target.value || undefined }))}
              aria-label="Filter apotek"
            >
              <option value="">Semua apotek</option>
              {(pharmacies.data ?? []).map((pharmacy) => (
                <option key={pharmacy.id} value={pharmacy.id}>
                  {pharmacy.name}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>
      </Card>

      {week.data ? (
        <ScheduleGrid key={`${weekStart}-${week.dataUpdatedAt}`} week={week.data} filters={filters} onDirtyChange={setDirtyCount} />
      ) : week.error ? (
        <Notice tone="red">{getErrorMessage(week.error)}</Notice>
      ) : (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      )}
    </>
  );
}
