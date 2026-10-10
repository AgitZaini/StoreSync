import { Clock, MessageCircle, PackageCheck, Undo2 } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QuantityInput, SelectInput, TextInput } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { Tabs } from "../../components/tabs";
import { useToast } from "../../components/toast-context";
import { Card, DataTable, EmptyState, Notice, PageHeader, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { formatBusinessDate, formatCurrency, formatDateTime, formatPhone } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { ReturnDoc, ReturnStatus } from "../../types/sales";
import { usePendingSalesReports, useReturnAction, useReturns } from "./sales-api";
import { ReturnCard } from "./sales-parts";

/** RTR-04: Admin menghitung barang retur yang tiba; bila berbeda dari yang disetujui, wajib dijelaskan. */
function ReceiveCard({ doc }: { doc: ReturnDoc }) {
  const action = useReturnAction();
  const showToast = useToast();
  const [values, setValues] = useState<Record<string, number | null>>(() => Object.fromEntries(doc.items.map((item) => [item.id, item.qty])));
  const [note, setNote] = useState("");
  const differs = doc.items.some((item) => (values[item.id] ?? 0) !== item.qty);
  const incomplete = doc.items.some((item) => values[item.id] === null);

  return (
    <ReturnCard doc={doc} showSpg showPhotos>
      <div className="mt-4 space-y-3 rounded-xl border border-line p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-subtle">Jumlah diterima gudang</p>
        <ul className="space-y-2">
          {doc.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {item.product.name} <span className="text-muted">(disetujui {item.qty})</span>
              </span>
              <QuantityInput
                value={values[item.id] ?? null}
                onChange={(value) => setValues((current) => ({ ...current, [item.id]: value }))}
                aria-label={`Diterima ${item.product.name}`}
              />
            </li>
          ))}
        </ul>
        {differs ? <p className="text-xs text-red-600">Jumlah berbeda dari yang disetujui; selisih akan ditandai dan Super Admin diberi tahu.</p> : null}
        <TextInput value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder={differs ? "Keterangan selisih (wajib)" : "Catatan (opsional)"} />
        <button
          type="button"
          disabled={incomplete || (differs && note.trim().length < 3) || action.isPending}
          onClick={() =>
            action.mutate(
              {
                returnId: doc.id,
                action: "receive",
                items: doc.items.map((item) => ({ itemId: item.id, qty: values[item.id] ?? 0 })),
                note: note.trim() || undefined,
              },
              {
                onSuccess: () => showToast(`${doc.code} diterima; stok pusat bertambah`),
                onError: (error) => showToast(getErrorMessage(error), "error"),
              },
            )
          }
          className={cn(buttonStyles.primary, "w-full")}
        >
          <PackageCheck />
          {action.isPending ? "Menyimpan..." : "Konfirmasi diterima gudang"}
        </button>
      </div>
    </ReturnCard>
  );
}

const RETURN_TABS: Array<{ key: string; param: string; label: string; status: ReturnStatus[]; empty: string }> = [
  { key: "receive", param: "terima", label: "Siap diterima", status: ["SA_APPROVED"], empty: "Tidak ada retur yang menunggu diterima gudang." },
  { key: "progress", param: "proses", label: "Dalam persetujuan", status: ["SUBMITTED", "KASIR_APPROVED"], empty: "Tidak ada retur yang sedang disetujui." },
  { key: "done", param: "selesai", label: "Selesai", status: ["RECEIVED", "REJECTED"], empty: "Belum ada retur selesai." },
];

/** RTR-04 untuk Admin: retur yang disetujui Super Admin diterima di gudang pusat (AB-08). */
export function IncomingReturnsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = RETURN_TABS.find((candidate) => candidate.param === searchParams.get("tab")) ?? RETURN_TABS[0];
  const returns = useReturns({ status: tab.status }, { live: true });
  const waiting = useReturns({ status: ["SA_APPROVED"] });

  return (
    <>
      <PageHeader title="Retur Masuk" description="Retur disetujui kasir dan Super Admin, lalu dikonfirmasi Admin saat barang tiba di gudang pusat." />
      <Tabs
        tabs={RETURN_TABS.map((candidate) => ({ key: candidate.key, label: candidate.label, count: candidate.key === "receive" ? waiting.data?.length : undefined }))}
        value={tab.key}
        onChange={(key) => setSearchParams({ tab: RETURN_TABS.find((candidate) => candidate.key === key)!.param }, { replace: true })}
      />
      {!returns.data ? (
        <div className="grid place-items-center py-16">
          {returns.error ? <Notice tone="red">{getErrorMessage(returns.error)}</Notice> : <Spinner />}
        </div>
      ) : returns.data.length === 0 ? (
        <Card>
          <EmptyState icon={Undo2}>{tab.empty}</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {returns.data.map((doc) => (tab.key === "receive" ? <ReceiveCard key={doc.id} doc={doc} /> : <ReturnCard key={doc.id} doc={doc} showSpg showPhotos />))}
        </div>
      )}
    </>
  );
}

const whatsappUrl = (phone: string) => `https://wa.me/${phone}`;

/** JUL-05: laporan yang belum diputuskan kasir lebih dari N hari, supaya Admin menghubungi apotek. */
export function PendingReportsPage() {
  const [days, setDays] = useState(1);
  const pending = usePendingSalesReports(days);

  return (
    <>
      <PageHeader title="Laporan Tertunda" description="Laporan penjualan yang belum disetujui kasir. Hubungi apoteknya supaya segera diperiksa." />
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-muted">
            Menunggu lebih dari
            <SelectInput value={String(days)} onChange={(event) => setDays(Number(event.target.value))} className="h-10 w-36">
              <option value="0">semua</option>
              <option value="1">1 hari</option>
              <option value="2">2 hari</option>
              <option value="3">3 hari</option>
            </SelectInput>
          </label>
          {pending.data ? <p className="text-sm text-muted">{pending.data.length} laporan</p> : null}
        </div>
      </Card>
      <Card>
        {!pending.data ? (
          <div className="grid place-items-center py-10">
            {pending.error ? <Notice tone="red">{getErrorMessage(pending.error)}</Notice> : <Spinner />}
          </div>
        ) : pending.data.length === 0 ? (
          <EmptyState icon={Clock}>Tidak ada laporan tertunda.</EmptyState>
        ) : (
          <DataTable
            minWidth="min-w-[760px]"
            headers={["Apotek", "SPG", "Tanggal penjualan", "Nilai", "Menunggu", "Hubungi kasir"]}
            rows={pending.data.map((report) => [
              <span key="pharmacy" className="block">
                <span className="block">{report.pharmacy.name}</span>
                <span className="block text-xs font-normal text-muted">{report.code}</span>
              </span>,
              report.spg.name,
              formatBusinessDate(report.reportDate),
              formatCurrency(report.totalAmount),
              <span key="age" className={cn("block", report.hoursWaiting >= 48 ? "font-semibold text-red-600" : "text-ink")}>
                {report.hoursWaiting >= 24 ? `${Math.floor(report.hoursWaiting / 24)} hari ${report.hoursWaiting % 24} jam` : `${report.hoursWaiting} jam`}
                <span className="block text-xs font-normal text-muted">sejak {formatDateTime(report.submittedAt)}</span>
              </span>,
              report.pharmacy.kasir ? (
                <a
                  key="contact"
                  href={whatsappUrl(report.pharmacy.kasir.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:underline"
                >
                  <MessageCircle className="size-4" />
                  {formatPhone(report.pharmacy.kasir.phone)}
                </a>
              ) : (
                "-"
              ),
            ])}
          />
        )}
      </Card>
    </>
  );
}
