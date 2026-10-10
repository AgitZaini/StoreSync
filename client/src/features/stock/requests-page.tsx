import { History } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SelectInput } from "../../components/form-controls";
import { Tabs } from "../../components/tabs";
import { Card, EmptyState, Notice, PageHeader, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { formatBusinessDate } from "../../lib/format";
import type { OrderStatus } from "../../types/stock";
import { useReturns, useSalesReports } from "../sales/sales-api";
import { ApprovalTrail, ReportStatusPill, ReturnCard, SalesItems } from "../sales/sales-parts";
import { OrderCard } from "./order-parts";
import { useOrders } from "./stock-api";
import { ORDER_STATUS } from "./stock-labels";

function Loading({ error }: { error: unknown }) {
  return <div className="grid place-items-center py-16">{error ? <Notice tone="red">{getErrorMessage(error)}</Notice> : <Spinner />}</div>;
}

function Empty() {
  return (
    <Card>
      <EmptyState icon={History}>Belum ada pengajuan.</EmptyState>
    </Card>
  );
}

function OrdersTab() {
  const [status, setStatus] = useState<OrderStatus | "">("");
  const orders = useOrders(status ? { status: [status] } : {});

  return (
    <>
      <Card>
        <div className="max-w-xs">
          <SelectInput value={status} onChange={(event) => setStatus(event.target.value as OrderStatus | "")} aria-label="Filter status">
            <option value="">Semua status</option>
            {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((key) => (
              <option key={key} value={key}>
                {ORDER_STATUS[key].label}
              </option>
            ))}
          </SelectInput>
        </div>
      </Card>
      {!orders.data ? (
        <Loading error={orders.error} />
      ) : orders.data.length === 0 ? (
        <Empty />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {orders.data.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </>
  );
}

function ReturnsTab() {
  const returns = useReturns();
  return !returns.data ? (
    <Loading error={returns.error} />
  ) : returns.data.length === 0 ? (
    <Empty />
  ) : (
    <div className="grid gap-4 xl:grid-cols-2">
      {returns.data.map((doc) => (
        <ReturnCard key={doc.id} doc={doc} />
      ))}
    </div>
  );
}

function ReportsTab() {
  const reports = useSalesReports();
  return !reports.data ? (
    <Loading error={reports.error} />
  ) : reports.data.length === 0 ? (
    <Empty />
  ) : (
    <div className="grid gap-4 xl:grid-cols-2">
      {reports.data.map((report) => (
        <Card key={report.id}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-semibold text-ink">{report.code}</p>
              <p className="text-xs text-muted">
                {report.pharmacy.name} · penjualan {formatBusinessDate(report.reportDate)} · revisi {report.revision}
              </p>
            </div>
            <ReportStatusPill report={report} />
          </div>
          <div className="mt-3 space-y-3">
            <SalesItems report={report} />
            <ApprovalTrail approvals={report.approvals} />
          </div>
        </Card>
      ))}
    </div>
  );
}

const TABS = [
  { key: "orders", param: null, label: "Order" },
  { key: "returns", param: "retur", label: "Retur" },
  { key: "reports", param: "laporan", label: "Laporan penjualan" },
] as const;

/** Riwayat pengajuan SPG: order, retur, dan laporan penjualan. Cuti menyusul (Tahap 8). */
export function RequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.find((candidate) => candidate.param === searchParams.get("tab")) ?? TABS[0];

  return (
    <>
      <PageHeader title="Riwayat Pengajuan" description="Status semua order, retur, dan laporan penjualan Anda." />
      <Tabs
        tabs={TABS.map((candidate) => ({ key: candidate.key, label: candidate.label }))}
        value={tab.key}
        onChange={(key) => {
          const param = TABS.find((candidate) => candidate.key === key)!.param;
          setSearchParams(param ? { tab: param } : {}, { replace: true });
        }}
      />
      {tab.key === "orders" ? <OrdersTab /> : tab.key === "returns" ? <ReturnsTab /> : <ReportsTab />}
    </>
  );
}
