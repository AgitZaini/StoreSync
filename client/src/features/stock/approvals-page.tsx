import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { TextInput } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { Tabs } from "../../components/tabs";
import { useToast } from "../../components/toast-context";
import { Card, EmptyState, Notice, PageHeader, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { cn } from "../../lib/utils";
import type { Order, WarehouseStockRow } from "../../types/stock";
import { OrderCard } from "./order-parts";
import { useOrderAction, useOrders, useWarehouseStock } from "./stock-api";
import { formatQty } from "./stock-labels";

/** ORD-02: Super Admin menyetujui (jumlah boleh dikurangi) atau menolak dengan alasan. */
function PendingOrderCard({ order, stock }: { order: Order; stock: WarehouseStockRow[] }) {
  const action = useOrderAction();
  const showToast = useToast();
  const [values, setValues] = useState<Record<string, number | null>>(() => Object.fromEntries(order.items.map((item) => [item.id, item.requestedQty])));
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const invalid = order.items.some((item) => values[item.id] === null || values[item.id]! > item.requestedQty);
  const nothing = order.items.every((item) => !values[item.id]);
  const stockOf = (productId: string) => stock.find((row) => row.product.id === productId)?.qty ?? 0;

  return (
    <OrderCard
      order={order}
      showSpg
      edit={{
        field: "approvedQty",
        label: "Disetujui",
        values,
        onChange: (itemId, value) => setValues((current) => ({ ...current, [itemId]: value })),
        max: (item) => item.requestedQty,
        hint: (item) => (
          <span className={stockOf(item.product.id) < (values[item.id] ?? 0) ? "text-orange-600" : undefined}>
            stok pusat sekarang {formatQty(stockOf(item.product.id))}
          </span>
        ),
      }}
      actions={
        <>
          <button type="button" onClick={() => setRejecting(true)} className={cn(buttonStyles.danger, buttonStyles.small)}>
            <XCircle />
            Tolak
          </button>
          <button
            type="button"
            disabled={invalid || nothing || action.isPending}
            onClick={() =>
              action.mutate(
                {
                  orderId: order.id,
                  action: "approve",
                  items: order.items.map((item) => ({ itemId: item.id, qty: values[item.id] ?? 0 })),
                  note: note.trim() || undefined,
                },
                {
                  onSuccess: () => showToast(`${order.code} disetujui; Admin diberi tahu untuk mengirim`),
                  onError: (error) => showToast(getErrorMessage(error), "error"),
                },
              )
            }
            className={cn(buttonStyles.primary, buttonStyles.small)}
          >
            <CheckCircle2 />
            Setujui
          </button>
        </>
      }
    >
      <div className="mt-3">
        <TextInput value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan persetujuan (opsional)" maxLength={300} />
        {nothing ? <p className="mt-1 text-xs text-orange-600">Semua jumlah 0 — tolak order ini bila memang tidak disetujui.</p> : null}
      </div>
      <ConfirmDialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={`Tolak ${order.code}`}
        message={`${order.spg.name} akan menerima notifikasi berisi alasan penolakan.`}
        reasonLabel="Alasan penolakan"
        confirmLabel="Tolak order"
        tone="danger"
        onConfirm={async (reason) => {
          await action.mutateAsync({ orderId: order.id, action: "reject", reason });
          showToast(`${order.code} ditolak`);
        }}
      />
    </OrderCard>
  );
}

function OrderApprovals() {
  const pending = useOrders({ status: ["SUBMITTED"] }, { live: true });
  const decided = useOrders({ status: ["APPROVED", "SHIPPED", "RECEIVED", "REJECTED"] });
  const stock = useWarehouseStock();

  if (!pending.data || !stock.data) {
    return (
      <div className="grid place-items-center py-16">
        {pending.error ? <Notice tone="red">{getErrorMessage(pending.error)}</Notice> : <Spinner />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pending.data.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardCheck}>Tidak ada order yang menunggu persetujuan.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pending.data.map((order) => (
            <PendingOrderCard key={order.id} order={order} stock={stock.data} />
          ))}
        </div>
      )}
      {decided.data && decided.data.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-subtle">Keputusan terakhir</h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {decided.data.slice(0, 6).map((order) => (
              <OrderCard key={order.id} order={order} showSpg />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Halaman persetujuan terpadu Super Admin (AB-13). Tahap ini: order; retur, cuti, dan MOU menyusul. */
export function ApprovalsPage() {
  const pending = useOrders({ status: ["SUBMITTED"] }, { live: true });

  return (
    <>
      <PageHeader title="Persetujuan" description="Semua persetujuan akhir ada di Super Admin. Retur, cuti, dan MOU akan bergabung di halaman ini." />
      <Tabs tabs={[{ key: "order", label: "Order", count: pending.data?.length }]} value="order" onChange={() => undefined} />
      <OrderApprovals />
    </>
  );
}
