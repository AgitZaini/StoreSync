import { CheckCircle2, PackageCheck, Truck } from "lucide-react";
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
import type { Order, WarehouseStockRow } from "../../types/stock";
import { OrderCard } from "./order-parts";
import { useOrderAction, useOrders, useWarehouseStock } from "./stock-api";
import type { OrderFilters } from "./stock-api";
import { formatQty } from "./stock-labels";

/** ORD-03: Admin mengirim; jumlah bawaan = disetujui, dibatasi stok pusat yang ada. */
function ShipCard({ order, stock }: { order: Order; stock: WarehouseStockRow[] }) {
  const action = useOrderAction();
  const showToast = useToast();
  const stockOf = (productId: string) => stock.find((row) => row.product.id === productId)?.qty ?? 0;
  const [values, setValues] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(order.items.map((item) => [item.id, Math.min(item.approvedQty ?? 0, stockOf(item.product.id))])),
  );
  const [note, setNote] = useState("");
  const invalid = order.items.some((item) => {
    const qty = values[item.id];
    return qty === null || qty > (item.approvedQty ?? 0) || qty > stockOf(item.product.id);
  });
  const nothing = order.items.every((item) => !values[item.id]);
  const short = order.items.some((item) => (values[item.id] ?? 0) < (item.approvedQty ?? 0));

  return (
    <OrderCard
      order={order}
      showSpg
      edit={{
        field: "shippedQty",
        label: "Dikirim",
        values,
        onChange: (itemId, value) => setValues((current) => ({ ...current, [itemId]: value })),
        max: (item) => Math.min(item.approvedQty ?? 0, stockOf(item.product.id)),
        hint: (item) => (
          <span className={stockOf(item.product.id) < (item.approvedQty ?? 0) ? "text-orange-600" : undefined}>
            stok pusat {formatQty(stockOf(item.product.id))}
          </span>
        ),
      }}
      actions={
        <button
          type="button"
          disabled={invalid || nothing || action.isPending}
          onClick={() =>
            action.mutate(
              {
                orderId: order.id,
                action: "ship",
                items: order.items.map((item) => ({ itemId: item.id, qty: values[item.id] ?? 0 })),
                note: note.trim() || undefined,
              },
              {
                onSuccess: () => showToast(`${order.code} ditandai dikirim; stok pusat berkurang`),
                onError: (error) => showToast(getErrorMessage(error), "error"),
              },
            )
          }
          className={cn(buttonStyles.primary, buttonStyles.small)}
        >
          <Truck />
          {action.isPending ? "Menyimpan..." : "Tandai dikirim"}
        </button>
      }
    >
      <div className="mt-3 space-y-1">
        <TextInput value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan pengiriman (opsional), mis. kurir" maxLength={300} />
        {short && !nothing ? <p className="text-xs text-orange-600">Sebagian dikirim kurang dari yang disetujui; kekurangannya tercatat di rekap permintaan.</p> : null}
        {nothing ? <p className="text-xs text-orange-600">Stok pusat belum cukup. Catat barang masuk dulu, lalu kirim.</p> : null}
      </div>
    </OrderCard>
  );
}

function DiscrepancyCard({ order }: { order: Order }) {
  const action = useOrderAction();
  const showToast = useToast();
  const [resolving, setResolving] = useState(false);

  return (
    <OrderCard
      order={order}
      showSpg
      actions={
        <button type="button" onClick={() => setResolving(true)} className={cn(buttonStyles.secondary, buttonStyles.small)}>
          <CheckCircle2 />
          Tandai ditindaklanjuti
        </button>
      }
    >
      <ConfirmDialog
        open={resolving}
        onClose={() => setResolving(false)}
        title={`Tindak lanjut selisih ${order.code}`}
        message="Catat hasil pengecekan (mis. dengan kurir atau gudang). Koreksi stok dilakukan terpisah bila diperlukan."
        reasonLabel="Catatan tindak lanjut"
        confirmLabel="Simpan"
        onConfirm={async (note) => {
          await action.mutateAsync({ orderId: order.id, action: "resolve-discrepancy", note });
          showToast(`Selisih ${order.code} ditandai sudah ditindaklanjuti`);
        }}
      />
    </OrderCard>
  );
}

type IncomingTab = "ship" | "shipped" | "discrepancy" | "done";

const TABS: Array<{ key: IncomingTab; param: string; label: string; filters: OrderFilters; empty: string }> = [
  { key: "ship", param: "kirim", label: "Siap dikirim", filters: { status: ["APPROVED"] }, empty: "Tidak ada order yang menunggu dikirim." },
  { key: "shipped", param: "dikirim", label: "Dalam pengiriman", filters: { status: ["SHIPPED"] }, empty: "Tidak ada order dalam pengiriman." },
  { key: "discrepancy", param: "selisih", label: "Selisih", filters: { openDiscrepancy: true }, empty: "Tidak ada selisih penerimaan yang perlu ditindaklanjuti." },
  { key: "done", param: "selesai", label: "Selesai", filters: { status: ["RECEIVED"] }, empty: "Belum ada order yang diterima." },
];

/** ORD-03/ORD-04 untuk Admin: kirim order yang disetujui dan tindak lanjuti selisih penerimaan. */
export function IncomingOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.find((candidate) => candidate.param === searchParams.get("tab")) ?? TABS[0];
  const orders = useOrders(tab.filters, { live: true });
  const toShip = useOrders(TABS[0].filters);
  const discrepancies = useOrders(TABS[2].filters);
  const stock = useWarehouseStock(tab.key === "ship");

  const counts: Partial<Record<IncomingTab, number | undefined>> = { ship: toShip.data?.length, discrepancy: discrepancies.data?.length };
  const ready = orders.data && (tab.key !== "ship" || stock.data);

  return (
    <>
      <PageHeader title="Order Masuk" description="Order yang sudah disetujui Super Admin, pengirimannya, dan selisih saat diterima SPG." />
      <Tabs
        tabs={TABS.map((candidate) => ({ key: candidate.key, label: candidate.label, count: counts[candidate.key] }))}
        value={tab.key}
        onChange={(key) => setSearchParams({ tab: TABS.find((candidate) => candidate.key === key)!.param }, { replace: true })}
      />
      {!ready ? (
        <div className="grid place-items-center py-16">
          {orders.error ? <Notice tone="red">{getErrorMessage(orders.error)}</Notice> : <Spinner />}
        </div>
      ) : orders.data!.length === 0 ? (
        <Card>
          <EmptyState icon={tab.key === "ship" ? Truck : PackageCheck}>{tab.empty}</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {orders.data!.slice(0, tab.key === "done" ? 30 : undefined).map((order) =>
            tab.key === "ship" ? (
              <ShipCard key={order.id} order={order} stock={stock.data!} />
            ) : tab.key === "discrepancy" ? (
              <DiscrepancyCard key={order.id} order={order} />
            ) : (
              <OrderCard key={order.id} order={order} showSpg />
            ),
          )}
        </div>
      )}
    </>
  );
}
