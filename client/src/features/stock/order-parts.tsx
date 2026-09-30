import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { QuantityInput } from "../../components/form-controls";
import { Card, Pill } from "../../components/ui";
import { formatDateTime } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { Order, OrderItem } from "../../types/stock";
import { formatQty, ORDER_STATUS } from "./stock-labels";

export function OrderStatusPills({ order }: { order: Order }) {
  const status = ORDER_STATUS[order.status];

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Pill tone={status.tone}>{status.label}</Pill>
      {order.hasDiscrepancy ? (
        <Pill tone={order.discrepancyResolvedAt ? "gray" : "red"}>{order.discrepancyResolvedAt ? "Selisih ditindaklanjuti" : "Ada selisih"}</Pill>
      ) : null}
      {order.status === "SUBMITTED" && order.items.some((item) => item.unfulfilledAtSubmit) ? (
        <Pill tone="gray">Sebagian belum terpenuhi</Pill>
      ) : null}
    </span>
  );
}

export type QtyEdit = {
  field: "approvedQty" | "shippedQty" | "receivedQty";
  label: string;
  values: Record<string, number | null>;
  onChange: (itemId: string, value: number | null) => void;
  max?: (item: OrderItem) => number | undefined;
  /** Keterangan tambahan per item, mis. stok pusat sekarang. */
  hint?: (item: OrderItem) => ReactNode;
};

const COLUMNS: Array<{ field: "requestedQty" | "approvedQty" | "shippedQty" | "receivedQty"; label: string }> = [
  { field: "requestedQty", label: "Diminta" },
  { field: "approvedQty", label: "Disetujui" },
  { field: "shippedQty", label: "Dikirim" },
  { field: "receivedQty", label: "Diterima" },
];

/** Daftar item order: angka tiap tahap, dan satu kolom yang bisa diisi saat memproses. */
export function OrderItems({ order, edit }: { order: Order; edit?: QtyEdit }) {
  const editIndex = edit ? COLUMNS.findIndex((column) => column.field === edit.field) : COLUMNS.length;
  const shown = COLUMNS.filter((column, index) => index < editIndex && order.items.some((item) => item[column.field] !== null));

  return (
    <ul className="divide-y divide-line">
      {order.items.map((item) => {
        const differs = item.receivedQty !== null && item.shippedQty !== null && item.receivedQty !== item.shippedQty;
        return (
          <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {item.product.name} <span className="font-normal text-muted">· {item.product.unit}</span>
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                {shown.map((column) => (
                  <span key={column.field} className={cn(column.field === "receivedQty" && differs && "font-semibold text-red-600")}>
                    {column.label} <span className="font-semibold tabular-nums text-ink">{formatQty(item[column.field] ?? 0)}</span>
                  </span>
                ))}
                {item.unfulfilledAtSubmit && (order.status === "SUBMITTED" || order.status === "APPROVED") ? (
                  <span className="inline-flex items-center gap-1 text-orange-600">
                    <AlertTriangle className="size-3" /> stok pusat {formatQty(item.stockAtSubmit)} saat diajukan
                  </span>
                ) : null}
                {edit?.hint?.(item)}
              </p>
            </div>
            {edit ? (
              <label className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[11px] font-medium text-muted">{edit.label}</span>
                <QuantityInput
                  value={edit.values[item.id] ?? null}
                  onChange={(value) => edit.onChange(item.id, value)}
                  max={edit.max?.(item)}
                  aria-label={`${edit.label} ${item.product.name}`}
                />
              </label>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Jejak proses order: siapa memutuskan/mengirim/menerima, kapan, dan catatannya. */
export function OrderTimeline({ order }: { order: Order }) {
  const decision = order.approvals.at(-1);
  const lines: Array<{ label: string; note?: string | null; tone?: string }> = [
    { label: `Diajukan ${formatDateTime(order.submittedAt)} oleh ${order.spg.name}`, note: order.note },
  ];

  if (decision) {
    lines.push({
      label: `${decision.decision === "APPROVED" ? "Disetujui" : "Ditolak"} ${formatDateTime(decision.decidedAt)} oleh ${decision.approver.name}`,
      note: decision.reason,
      tone: decision.decision === "REJECTED" ? "text-red-600" : undefined,
    });
  }
  if (order.shippedAt) lines.push({ label: `Dikirim ${formatDateTime(order.shippedAt)} oleh ${order.shippedBy?.name ?? "Admin"}`, note: order.shipNote });
  if (order.receivedAt) {
    lines.push({ label: `Diterima ${formatDateTime(order.receivedAt)}`, note: order.receiveNote, tone: order.hasDiscrepancy ? "text-red-600" : undefined });
  }
  if (order.discrepancyResolvedAt) {
    lines.push({
      label: `Selisih ditindaklanjuti ${formatDateTime(order.discrepancyResolvedAt)} oleh ${order.discrepancyResolvedBy?.name ?? "Admin"}`,
      note: order.discrepancyNote,
    });
  }

  return (
    <ol className="space-y-1.5 border-l-2 border-line pl-3 text-xs">
      {lines.map((line) => (
        <li key={line.label}>
          <span className={cn("text-muted", line.tone)}>{line.label}</span>
          {line.note ? <span className="block text-ink">“{line.note}”</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function OrderCard({
  order,
  showSpg = false,
  edit,
  actions,
  children,
}: {
  order: Order;
  showSpg?: boolean;
  edit?: QtyEdit;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink">{order.code}</p>
          <p className="text-xs text-muted">
            {order.pharmacy.name}
            {showSpg ? ` · ${order.spg.name}${order.spg.team ? ` (${order.spg.team.name})` : ""}` : ""}
          </p>
        </div>
        <OrderStatusPills order={order} />
      </div>
      <div className="mt-3">
        <OrderItems order={order} edit={edit} />
      </div>
      {order.status === "REJECTED" && order.rejectReason ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">Ditolak: {order.rejectReason}</p>
      ) : null}
      {children}
      <div className="mt-4">
        <OrderTimeline order={order} />
      </div>
      {actions ? <div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div> : null}
    </Card>
  );
}
