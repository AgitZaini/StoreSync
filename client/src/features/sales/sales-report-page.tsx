import { isAxiosError } from "axios";
import { Pencil, ReceiptText, Send, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogActions } from "../../components/dialog";
import { QuantityInput, SelectInput, TextArea } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { useToast } from "../../components/toast-context";
import { Card, EmptyState, Field, Notice, PageHeader, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { currentMonth, formatBusinessDate, formatCurrency, formatMonth, shiftDate, todayDate } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { SalesReport } from "../../types/sales";
import { usePharmacies } from "../pharmacies/pharmacies-api";
import { useAvailableStock, useSalesPerformance, useSalesReports, useSubmitSalesReport } from "./sales-api";
import { ApprovalTrail, ReportStatusPill, SalesItems } from "./sales-parts";

type Shortage = { productName: string; requested: number; available: number };

const shortagesOf = (error: unknown): Shortage[] =>
  isAxiosError<{ code?: string; details?: { items?: Shortage[] } }>(error) && error.response?.data?.code === "EXCEEDS_STOCK"
    ? (error.response.data.details?.items ?? [])
    : [];

/** Omzet bulan ini (laporan disetujui kasir) dibanding target. */
function MonthProgress() {
  const month = currentMonth();
  const performance = useSalesPerformance(month);
  const totals = performance.data?.totals;
  const percent = totals?.percent ?? 0;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Omzet {formatMonth(month)}</p>
          <p className="text-2xl font-semibold tabular-nums text-ink">{totals ? formatCurrency(totals.approvedAmount) : "…"}</p>
          <p className="text-xs text-muted">
            Target {totals && Number(totals.target) > 0 ? formatCurrency(totals.target) : "belum diatur"}
            {totals && Number(totals.pendingAmount) > 0 ? ` · ${formatCurrency(totals.pendingAmount)} menunggu kasir` : ""}
          </p>
        </div>
        <Target className="size-5 text-brand-500" />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <p className="mt-1 text-right text-xs font-medium text-muted">{totals?.percent !== null && totals ? `${totals.percent}%` : "-"}</p>
    </Card>
  );
}

/** JUL-01: form laporan (baru atau perbaikan) dengan stok tersedia per produk, dicek langsung (BR-14). */
function ReportForm({ pharmacyId, reportDate, report, onDone }: { pharmacyId: string; reportDate: string; report?: SalesReport; onDone: () => void }) {
  const available = useAvailableStock(pharmacyId, report ? { excludeSalesReportId: report.id } : {});
  const submit = useSubmitSalesReport();
  const showToast = useToast();
  const [quantities, setQuantities] = useState<Record<string, number | null>>(() =>
    Object.fromEntries((report?.items ?? []).map((item) => [item.product.id, item.qty])),
  );
  const [note, setNote] = useState(report?.note ?? "");

  const rows = available.data ?? [];
  const lines = rows
    .map((row) => ({ row, qty: quantities[row.product.id] ?? 0 }))
    .filter((line) => line.qty > 0);
  const over = lines.filter((line) => line.qty > line.row.available);
  const total = lines.reduce((sum, line) => sum + line.qty * Number(line.row.product.price), 0);
  const serverShortages = shortagesOf(submit.error);

  return (
    <div className="space-y-4">
      {!available.data ? (
        <div className="grid place-items-center py-8">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={ReceiptText}>Belum ada stok di apotek ini. Stok awal diisi Admin; tambahan lewat Order Barang.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line px-3">
          {rows.map((row) => {
            const qty = quantities[row.product.id] ?? null;
            const tooMany = qty !== null && qty > row.available;
            return (
              <li key={row.product.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{row.product.name}</span>
                  <span className={cn("block text-xs", tooMany ? "font-medium text-red-600" : "text-muted")}>
                    Tersedia {row.available} {row.product.unit} · {formatCurrency(row.product.price)}
                    {row.pendingSales + row.pendingReturns > 0 ? ` · ${row.pendingSales + row.pendingReturns} tertahan` : ""}
                  </span>
                </span>
                <QuantityInput
                  value={qty}
                  max={row.available}
                  onChange={(value) => setQuantities((current) => ({ ...current, [row.product.id]: value }))}
                  placeholder="0"
                  aria-label={`Terjual ${row.product.name}`}
                />
              </li>
            );
          })}
        </ul>
      )}

      {over.length > 0 ? <Notice tone="red">Jumlah melebihi stok tersedia untuk {over.map((line) => line.row.product.name).join(", ")}. Laporan tidak bisa dikirim.</Notice> : null}

      <Field label="Catatan (opsional)">
        <TextArea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} className="min-h-16" />
      </Field>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
        <span className="text-sm text-muted">Total omzet</span>
        <span className="text-lg font-semibold tabular-nums text-ink">{formatCurrency(total)}</span>
      </div>

      {submit.error ? (
        <Notice tone="red">
          {serverShortages.length > 0
            ? `Stok berubah: ${serverShortages.map((line) => `${line.productName} tersedia ${line.available}`).join(", ")}.`
            : getErrorMessage(submit.error)}
        </Notice>
      ) : null}

      <button
        type="button"
        disabled={lines.length === 0 || over.length > 0 || submit.isPending}
        onClick={() =>
          submit.mutate(
            {
              reportId: report?.id,
              pharmacyId,
              reportDate,
              note: note.trim() || undefined,
              items: lines.map((line) => ({ productId: line.row.product.id, qty: line.qty })),
            },
            {
              onSuccess: (saved) => {
                showToast(report ? `${saved.code} dikirim ulang ke kasir` : `${saved.code} dikirim ke kasir`);
                onDone();
              },
            },
          )
        }
        className={cn(buttonStyles.primary, "h-12 w-full text-base")}
      >
        <Send />
        {submit.isPending ? "Mengirim..." : report ? "Kirim ulang ke kasir" : "Kirim ke kasir"}
      </button>
    </div>
  );
}

/** JUL-01/JUL-04 untuk SPG: satu laporan per apotek per hari, disetujui kasir sebelum jadi omzet. */
export function SalesReportPage() {
  const pharmacies = usePharmacies();
  const today = todayDate();
  const [pharmacyState, setPharmacyId] = useState("");
  const [reportDate, setReportDate] = useState(today);
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState<SalesReport | null>(null);
  const pharmacyId = pharmacyState || pharmacies.data?.[0]?.id || "";
  const recent = useSalesReports({ from: shiftDate(today, -30), to: today });
  const current = useMemo(
    () => recent.data?.find((report) => report.pharmacy.id === pharmacyId && report.reportDate === reportDate),
    [recent.data, pharmacyId, reportDate],
  );
  const showForm = !current || (current.status !== "APPROVED" && (current.status === "REJECTED" || editing));

  return (
    <>
      <PageHeader title="Laporan Penjualan" description="Sekali sehari per apotek. Omzet dihitung setelah disetujui kasir apotek." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Apotek">
                <SelectInput
                  value={pharmacyId}
                  onChange={(event) => {
                    setPharmacyId(event.target.value);
                    setEditing(false);
                  }}
                >
                  {(pharmacies.data ?? []).map((pharmacy) => (
                    <option key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Tanggal penjualan">
                <SelectInput
                  value={reportDate}
                  onChange={(event) => {
                    setReportDate(event.target.value);
                    setEditing(false);
                  }}
                >
                  <option value={today}>Hari ini · {formatBusinessDate(today)}</option>
                  <option value={shiftDate(today, -1)}>Kemarin · {formatBusinessDate(shiftDate(today, -1))}</option>
                </SelectInput>
              </Field>
            </div>
          </Card>

          {!pharmacies.data || !recent.data ? (
            <div className="grid place-items-center py-10">
              <Spinner />
            </div>
          ) : !pharmacyId ? (
            <Card>
              <EmptyState icon={ReceiptText}>Anda belum ditempatkan di apotek.</EmptyState>
            </Card>
          ) : (
            <Card
              title={current ? `${current.code} · revisi ${current.revision}` : "Laporan baru"}
              action={current ? <ReportStatusPill report={current} /> : null}
            >
              {current?.status === "REJECTED" ? (
                <div className="mb-4">
                  <Notice tone="red">Ditolak kasir: {current.rejectReason}. Perbaiki jumlahnya lalu kirim ulang.</Notice>
                </div>
              ) : null}
              {showForm ? (
                <ReportForm
                  key={`${pharmacyId}:${reportDate}:${current?.id ?? "baru"}:${current?.revision ?? 0}`}
                  pharmacyId={pharmacyId}
                  reportDate={reportDate}
                  report={current}
                  onDone={() => setEditing(false)}
                />
              ) : (
                <div className="space-y-4">
                  <SalesItems report={current!} />
                  <ApprovalTrail approvals={current!.approvals} />
                  {current!.status === "SUBMITTED" ? (
                    <button type="button" onClick={() => setEditing(true)} className={cn(buttonStyles.secondary, "w-full")}>
                      <Pencil />
                      Ubah sebelum kasir memutuskan
                    </button>
                  ) : (
                    <p className="text-xs text-muted">Laporan yang sudah disetujui tidak bisa diubah (AB-06).</p>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <MonthProgress />
          <Card title="30 hari terakhir">
            {!recent.data ? (
              <Spinner />
            ) : recent.data.length === 0 ? (
              <p className="text-sm text-muted">Belum ada laporan.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recent.data.map((report) => (
                  <li key={report.id}>
                    <button type="button" onClick={() => setViewing(report)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{formatBusinessDate(report.reportDate)}</span>
                        <span className="block truncate text-xs text-muted">
                          {report.pharmacy.name} · {formatCurrency(report.totalAmount)}
                        </span>
                      </span>
                      <ReportStatusPill report={report} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {viewing ? (
        <Dialog
          open
          onClose={() => setViewing(null)}
          title={`${viewing.code} · ${formatBusinessDate(viewing.reportDate, { weekday: "long", day: "numeric", month: "long" })}`}
          description={viewing.pharmacy.name}
        >
          <div className="space-y-4">
            <ReportStatusPill report={viewing} />
            <SalesItems report={viewing} />
            <ApprovalTrail approvals={viewing.approvals} />
          </div>
          <DialogActions>
            <button type="button" onClick={() => setViewing(null)} className={buttonStyles.secondary}>
              Tutup
            </button>
          </DialogActions>
        </Dialog>
      ) : null}
    </>
  );
}
