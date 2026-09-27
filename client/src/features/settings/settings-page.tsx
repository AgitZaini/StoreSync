import { CalendarDays, Wallet } from "lucide-react";
import { useState } from "react";
import { RupiahInput, TextInput } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { useToast } from "../../components/toast-context";
import { Card, DataTable, Field, Notice, PageHeader, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { formatCurrency, formatDateTime } from "../../lib/format";
import type { Settings } from "../../types/master-data";
import { useAddDeductionRate, useSettings, useUpdateLeaveQuota } from "./settings-api";

function LeaveQuotaCard({ settings }: { settings: Settings }) {
  const updateLeaveQuota = useUpdateLeaveQuota();
  const showToast = useToast();
  const [days, setDays] = useState(String(settings.leaveQuotaDays));
  const parsed = Number(days);
  const valid = days !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= 60;

  return (
    <Card title="Jatah cuti Team Leader" action={<CalendarDays className="size-[18px] text-brand-500" />}>
      <p className="mb-4 text-sm leading-relaxed text-muted">
        Jumlah hari cuti per tahun, <strong className="font-medium text-ink">termasuk izin sakit</strong> (AB-12). Hari di luar jatah
        dipotong sesuai nominal di bawah.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Hari per tahun">
          <TextInput
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            invalid={!valid}
            className="sm:w-32"
          />
        </Field>
        <button
          type="button"
          disabled={!valid || parsed === settings.leaveQuotaDays || updateLeaveQuota.isPending}
          onClick={() => updateLeaveQuota.mutate(parsed, { onSuccess: () => showToast("Jatah cuti disimpan") })}
          className={buttonStyles.primary}
        >
          {updateLeaveQuota.isPending ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
      {updateLeaveQuota.error ? (
        <div className="mt-3">
          <Notice tone="red">{getErrorMessage(updateLeaveQuota.error)}</Notice>
        </div>
      ) : null}
    </Card>
  );
}

function DeductionRateCard({ settings }: { settings: Settings }) {
  const addDeductionRate = useAddDeductionRate();
  const showToast = useToast();
  const [amount, setAmount] = useState<number | null>(null);

  return (
    <Card title="Potongan cuti per hari" action={<Wallet className="size-[18px] text-brand-500" />}>
      <div className="rounded-2xl bg-canvas p-4">
        <p className="text-xs text-muted">Tarif berlaku</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular-nums">
          {settings.deductionRate ? formatCurrency(settings.deductionRate.amountPerDay) : "Belum diatur"}
        </p>
        {settings.deductionRate ? (
          <p className="mt-1 text-xs text-muted">Sejak {formatDateTime(settings.deductionRate.effectiveFrom)}</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <span className="flex-1">
          <Field label="Tarif baru per hari">
            <RupiahInput value={amount} onChange={setAmount} placeholder="0" />
          </Field>
        </span>
        <button
          type="button"
          disabled={amount === null || addDeductionRate.isPending}
          onClick={() =>
            addDeductionRate.mutate(amount!, {
              onSuccess: () => {
                setAmount(null);
                showToast("Tarif potongan baru berlaku");
              },
            })
          }
          className={buttonStyles.primary}
        >
          {addDeductionRate.isPending ? "Menyimpan..." : "Tetapkan tarif"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Tarif baru hanya berlaku untuk cuti yang disetujui setelah disimpan (AKN-05). Cuti yang sudah disetujui tetap memakai tarif
        lamanya.
      </p>
      {addDeductionRate.error ? (
        <div className="mt-3">
          <Notice tone="red">{getErrorMessage(addDeductionRate.error)}</Notice>
        </div>
      ) : null}

      {settings.deductionRates.length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-subtle">Riwayat tarif</p>
          <DataTable
            minWidth="min-w-[420px]"
            headers={["Tarif", "Berlaku sejak", "Ditetapkan oleh"]}
            rows={settings.deductionRates.map((rate) => [
              formatCurrency(rate.amountPerDay),
              formatDateTime(rate.effectiveFrom),
              rate.createdByName ?? "-",
            ])}
          />
        </div>
      ) : null}
    </Card>
  );
}

export function SettingsPage() {
  const settings = useSettings();

  return (
    <>
      <PageHeader title="Pengaturan" description="Jatah cuti dan potongan per hari untuk Team Leader." />
      {settings.isPending ? (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      ) : settings.data ? (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <LeaveQuotaCard key={`quota-${settings.data.leaveQuotaDays}`} settings={settings.data} />
          <DeductionRateCard settings={settings.data} />
        </div>
      ) : (
        <Notice tone="red">{getErrorMessage(settings.error)}</Notice>
      )}
    </>
  );
}
