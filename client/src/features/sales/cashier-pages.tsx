import { CheckCircle2, ClipboardCheck, History, XCircle } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { StoredImage } from "../../components/stored-image";
import { buttonStyles } from "../../components/styles";
import { Tabs } from "../../components/tabs";
import { useToast } from "../../components/toast-context";
import { Card, EmptyState, Notice, PageHeader, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { formatBusinessDate, formatCurrency, formatDateTime } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { ReturnDoc, SalesReport } from "../../types/sales";
import { usePharmacies } from "../pharmacies/pharmacies-api";
import { useKasirSalesDecision, useReturnAction, useReturns, useSalesReports } from "./sales-api";
import { ApprovalTrail, CashierDecisionDialog, ReportStatusPill, ReturnItems, ReturnStatusPill, SalesItems } from "./sales-parts";

type Decision = { kind: "report"; report: SalesReport; mode: "approve" | "reject" } | { kind: "return"; doc: ReturnDoc; mode: "approve" | "reject" };

function DecisionButtons({ onReject, onApprove }: { onReject: () => void; onApprove: () => void }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button type="button" onClick={onReject} className={cn(buttonStyles.danger, "h-11")}>
        <XCircle />
        Tolak
      </button>
      <button type="button" onClick={onApprove} className={cn(buttonStyles.primary, "h-11")}>
        <CheckCircle2 />
        Setujui
      </button>
    </div>
  );
}

function PendingReportCard({ report, onDecide }: { report: SalesReport; onDecide: (mode: "approve" | "reject") => void }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{report.spg.name}</p>
          <p className="text-xs text-muted">
            Penjualan {formatBusinessDate(report.reportDate, { weekday: "long", day: "numeric", month: "long" })} · {report.code}
            {report.revision > 1 ? ` · perbaikan ke-${report.revision - 1}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-base font-semibold tabular-nums text-ink">{formatCurrency(report.totalAmount)}</span>
      </div>
      <div className="mt-3">
        <SalesItems report={report} />
      </div>
      {report.note ? <p className="mt-2 text-sm text-muted">Catatan SPG: “{report.note}”</p> : null}
      {report.approvals.length > 0 ? (
        <div className="mt-3">
          <ApprovalTrail approvals={report.approvals} showPhotos />
        </div>
      ) : null}
      <p className="mt-3 text-xs text-muted">Periksa dengan nota/penjualan hari itu. Setelah disetujui, laporan tidak bisa diubah.</p>
      <DecisionButtons onReject={() => onDecide("reject")} onApprove={() => onDecide("approve")} />
    </Card>
  );
}

function PendingReturnCard({ doc, onDecide }: { doc: ReturnDoc; onDecide: (mode: "approve" | "reject") => void }) {
  return (
    <Card>
      <div className="flex gap-3">
        {doc.photoFileId ? <StoredImage fileId={doc.photoFileId} alt="Foto barang retur" className="size-20 shrink-0 rounded-xl" /> : null}
        <div className="min-w-0">
          <p className="font-semibold text-ink">{doc.spg.name}</p>
          <p className="text-xs text-muted">
            Retur ke gudang pusat · {doc.code} · {formatDateTime(doc.submittedAt)}
          </p>
          <p className="mt-1 text-sm text-ink">“{doc.reason}”</p>
        </div>
      </div>
      <div className="mt-3">
        <ReturnItems doc={doc} />
      </div>
      <p className="mt-3 text-xs text-muted">Setujui bila barang ini memang keluar dari apotek Anda.</p>
      <DecisionButtons onReject={() => onDecide("reject")} onApprove={() => onDecide("approve")} />
    </Card>
  );
}

/** JUL-03 + RTR-02: kasir memutuskan laporan penjualan dan retur SPG di apoteknya sendiri. */
export function CashierApprovalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "retur" ? "returns" : "reports";
  const reports = useSalesReports({ status: ["SUBMITTED"] }, { live: true });
  const returns = useReturns({ status: ["SUBMITTED"] }, { live: true });
  const pharmacy = usePharmacies().data?.[0];
  const salesDecision = useKasirSalesDecision();
  const returnAction = useReturnAction();
  const showToast = useToast();
  const [decision, setDecision] = useState<Decision | null>(null);

  const list = tab === "reports" ? reports : returns;

  return (
    <>
      <PageHeader title="Menunggu Persetujuan" description={pharmacy ? `${pharmacy.name} · laporan penjualan dan retur dari SPG` : undefined} />
      <Tabs
        tabs={[
          { key: "reports", label: "Laporan penjualan", count: reports.data?.length },
          { key: "returns", label: "Retur", count: returns.data?.length },
        ]}
        value={tab}
        onChange={(key) => setSearchParams(key === "returns" ? { tab: "retur" } : {}, { replace: true })}
      />

      {!list.data ? (
        <div className="grid place-items-center py-16">
          {list.error ? <Notice tone="red">{getErrorMessage(list.error)}</Notice> : <Spinner />}
        </div>
      ) : list.data.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardCheck}>{tab === "reports" ? "Tidak ada laporan penjualan yang menunggu." : "Tidak ada retur yang menunggu."}</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tab === "reports"
            ? reports.data!.map((report) => (
                <PendingReportCard key={report.id} report={report} onDecide={(mode) => setDecision({ kind: "report", report, mode })} />
              ))
            : returns.data!.map((doc) => <PendingReturnCard key={doc.id} doc={doc} onDecide={(mode) => setDecision({ kind: "return", doc, mode })} />)}
        </div>
      )}

      {decision ? (
        <CashierDecisionDialog
          mode={decision.mode}
          pharmacyName={pharmacy?.name ?? ""}
          title={`${decision.mode === "approve" ? "Setujui" : "Tolak"} ${decision.kind === "report" ? "laporan penjualan" : "retur"}`}
          description={
            decision.kind === "report"
              ? `${decision.report.spg.name} · ${formatCurrency(decision.report.totalAmount)}`
              : `${decision.doc.spg.name} · ${decision.doc.code}`
          }
          onClose={() => setDecision(null)}
          onSubmit={async (identity, reason) => {
            if (decision.kind === "report") {
              await salesDecision.mutateAsync({
                reportId: decision.report.id,
                decision: decision.mode,
                revision: decision.report.revision,
                reason,
                ...identity,
              });
            } else if (decision.mode === "approve") {
              await returnAction.mutateAsync({ returnId: decision.doc.id, action: "kasir-approve", ...identity });
            } else {
              await returnAction.mutateAsync({ returnId: decision.doc.id, action: "kasir-reject", reason: reason!, ...identity });
            }
            showToast(decision.mode === "approve" ? "Persetujuan tersimpan" : "Penolakan dikirim ke SPG");
          }}
        />
      ) : null}
    </>
  );
}

/** Riwayat keputusan akun apotek ini: siapa kasirnya, kapan, dan fotonya. */
export function CashierHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "retur" ? "returns" : "reports";
  const reports = useSalesReports({ status: ["APPROVED", "REJECTED"] });
  const returns = useReturns({ status: ["KASIR_APPROVED", "SA_APPROVED", "RECEIVED", "REJECTED"] });
  const returnRows = (returns.data ?? []).filter((doc) => doc.approvals.some((approval) => approval.step === "KASIR"));
  const list = tab === "reports" ? reports.data : returns.data ? returnRows : undefined;

  return (
    <>
      <PageHeader title="Riwayat Persetujuan" description="Keputusan yang sudah diberikan apotek ini, dengan nama dan foto kasir." />
      <Tabs
        tabs={[
          { key: "reports", label: "Laporan penjualan" },
          { key: "returns", label: "Retur" },
        ]}
        value={tab}
        onChange={(key) => setSearchParams(key === "returns" ? { tab: "retur" } : {}, { replace: true })}
      />
      {!list ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={History}>Belum ada keputusan.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tab === "reports"
            ? reports.data!.map((report) => (
                <Card key={report.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{report.spg.name}</p>
                      <p className="text-xs text-muted">
                        {formatBusinessDate(report.reportDate)} · {report.code} · {formatCurrency(report.totalAmount)}
                      </p>
                    </div>
                    <ReportStatusPill report={report} />
                  </div>
                  <div className="mt-3">
                    <ApprovalTrail approvals={report.approvals} showPhotos />
                  </div>
                </Card>
              ))
            : returnRows.map((doc) => (
                <Card key={doc.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{doc.spg.name}</p>
                      <p className="text-xs text-muted">
                        {doc.code} · {doc.items.map((item) => `${item.product.name} × ${item.qty}`).join(", ")}
                      </p>
                    </div>
                    <ReturnStatusPill doc={doc} />
                  </div>
                  <div className="mt-3">
                    <ApprovalTrail approvals={doc.approvals.filter((approval) => approval.step === "KASIR")} showPhotos />
                  </div>
                </Card>
              ))}
        </div>
      )}
    </>
  );
}
