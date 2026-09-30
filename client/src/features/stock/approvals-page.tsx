import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { TextInput } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { Tabs } from "../../components/tabs";
import { useToast } from "../../components/toast-context";
import { Card, EmptyState, Notice, PageHeader, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { cn } from "../../lib/utils";
import type { ReturnDoc } from "../../types/sales";
import type { Order, WarehouseStockRow } from "../../types/stock";
import { useReturnAction, useReturns } from "../sales/sales-api";
import { ReturnCard } from "../sales/sales-parts";
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

/** RTR-03: retur yang sudah disetujui kasir menunggu keputusan Super Admin; tolak wajib beralasan. */
function PendingReturnCard({ doc }: { doc: ReturnDoc }) {
  const action = useReturnAction();
  const showToast = useToast();
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  return (
    <ReturnCard doc={doc} showSpg showPhotos>
      <div className="mt-3 space-y-3">
        <TextInput value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan persetujuan (opsional)" maxLength={300} />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setRejecting(true)} className={cn(buttonStyles.danger, buttonStyles.small)}>
            <XCircle />
            Tolak
          </button>
          <button
            type="button"
            disabled={action.isPending}
            onClick={() =>
              action.mutate(
                { returnId: doc.id, action: "approve", note: note.trim() || undefined },
                {
                  onSuccess: () => showToast(`${doc.code} disetujui; Admin diberi tahu untuk menerima barang`),
                  onError: (error) => showToast(getErrorMessage(error), "error"),
                },
              )
            }
            className={cn(buttonStyles.primary, buttonStyles.small)}
          >
            <CheckCircle2 />
            Setujui
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={`Tolak ${doc.code}`}
        message={`${doc.spg.name} akan menerima notifikasi berisi alasan penolakan; barang tetap di apotek.`}
        reasonLabel="Alasan penolakan"
        confirmLabel="Tolak retur"
        tone="danger"
        onConfirm={async (reason) => {
          await action.mutateAsync({ returnId: doc.id, action: "reject", reason });
          showToast(`${doc.code} ditolak`);
        }}
      />
    </ReturnCard>
  );
}

function ReturnApprovals() {
  const pending = useReturns({ status: ["KASIR_APPROVED"] }, { live: true });
  const decided = useReturns({ status: ["SA_APPROVED", "RECEIVED", "REJECTED"] });

  if (!pending.data) {
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
          <EmptyState icon={ClipboardCheck}>Tidak ada retur yang menunggu persetujuan.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pending.data.map((doc) => (
            <PendingReturnCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
      {decided.data && decided.data.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-subtle">Keputusan terakhir</h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {decided.data.slice(0, 6).map((doc) => (
              <ReturnCard key={doc.id} doc={doc} showSpg showPhotos />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Halaman persetujuan terpadu Super Admin (AB-13): order dan retur; cuti dan MOU menyusul (Tahap 8). */
export function ApprovalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "retur" ? "returns" : "orders";
  const pendingOrders = useOrders({ status: ["SUBMITTED"] }, { live: true });
  const pendingReturns = useReturns({ status: ["KASIR_APPROVED"] }, { live: true });

  return (
    <>
      <PageHeader title="Persetujuan" description="Semua persetujuan akhir ada di Super Admin. Cuti dan MOU akan bergabung di halaman ini." />
      <Tabs
        tabs={[
          { key: "orders", label: "Order", count: pendingOrders.data?.length },
          { key: "returns", label: "Retur", count: pendingReturns.data?.length },
        ]}
        value={tab}
        onChange={(key) => setSearchParams(key === "returns" ? { tab: "retur" } : {}, { replace: true })}
      />
      {tab === "orders" ? <OrderApprovals /> : <ReturnApprovals />}
    </>
  );
}
