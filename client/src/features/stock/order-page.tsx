import { AlertTriangle, PackageCheck, PackagePlus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogActions } from "../../components/dialog";
import { QuantityInput, SelectInput, TextArea, TextInput } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { useToast } from "../../components/toast-context";
import { Card, EmptyState, Field, Notice, PageHeader, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { cn } from "../../lib/utils";
import type { Order } from "../../types/stock";
import { usePharmacies } from "../pharmacies/pharmacies-api";
import { OrderCard, OrderItems } from "./order-parts";
import { useOrderAction, useOrders, useSubmitOrder, useWarehouseStock } from "./stock-api";
import { formatQty, isOpenOrder } from "./stock-labels";

/** ORD-01: form order dengan stok pusat terlihat; jumlah di atas stok tetap boleh (permintaan belum terpenuhi). */
function NewOrderDialog({ onClose }: { onClose: () => void }) {
  const pharmacies = usePharmacies();
  const stock = useWarehouseStock();
  const submit = useSubmitOrder();
  const showToast = useToast();
  const [pharmacyId, setPharmacyId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number | null>>({});
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const selectedPharmacy = pharmacyId || (pharmacies.data?.length === 1 ? pharmacies.data[0].id : "");

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (stock.data ?? [])
      .filter((row) => row.product.isActive)
      .filter((row) => !query || `${row.product.name} ${row.product.code}`.toLowerCase().includes(query));
  }, [stock.data, search]);
  const items = Object.entries(quantities)
    .filter(([, qty]) => qty !== null && qty > 0)
    .map(([productId, qty]) => ({ productId, qty: qty! }));
  const shortages = items.filter((item) => item.qty > (stock.data?.find((row) => row.product.id === item.productId)?.qty ?? 0));

  const send = () =>
    submit.mutate(
      { pharmacyId: selectedPharmacy, items, note: note.trim() || undefined },
      {
        onSuccess: (order) => {
          showToast(`${order.code} dikirim ke Super Admin`);
          onClose();
        },
      },
    );

  return (
    <Dialog open onClose={onClose} title="Buat order" description="Stok pusat ditampilkan sebagai acuan; persetujuan oleh Super Admin." wide>
      <div className="space-y-4">
        <Field label="Apotek">
          <SelectInput value={selectedPharmacy} onChange={(event) => setPharmacyId(event.target.value)}>
            <option value="">Pilih apotek tugas</option>
            {(pharmacies.data ?? []).map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>
                {pharmacy.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari produk" className="pl-10" />
        </label>

        {!stock.data ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        ) : (
          <ul className="max-h-[45vh] divide-y divide-line overflow-y-auto rounded-xl border border-line px-3">
            {rows.map((row) => {
              const qty = quantities[row.product.id] ?? null;
              const short = qty !== null && qty > row.qty;
              return (
                <li key={row.product.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{row.product.name}</span>
                    <span className={cn("block text-xs", row.qty === 0 ? "text-orange-600" : "text-muted")}>
                      Stok pusat {formatQty(row.qty)} {row.product.unit}
                      {short ? " · kekurangan dicatat sebagai permintaan belum terpenuhi" : ""}
                    </span>
                  </span>
                  <QuantityInput
                    value={qty}
                    onChange={(value) => setQuantities((current) => ({ ...current, [row.product.id]: value }))}
                    aria-label={`Jumlah ${row.product.name}`}
                    placeholder="0"
                    className={short ? "border-orange-300" : undefined}
                  />
                </li>
              );
            })}
            {rows.length === 0 ? <li className="py-6 text-center text-sm text-muted">Produk tidak ditemukan.</li> : null}
          </ul>
        )}

        {shortages.length > 0 ? (
          <p className="flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {shortages.length} produk melebihi stok pusat. Order tetap bisa dikirim; kekurangannya menjadi dasar Admin membeli ke pabrik.
          </p>
        ) : null}

        <Field label="Catatan (opsional)">
          <TextArea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} className="min-h-16" />
        </Field>
        {submit.error ? <Notice tone="red">{getErrorMessage(submit.error)}</Notice> : null}
      </div>
      <DialogActions>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Batal
        </button>
        <button type="button" disabled={!selectedPharmacy || items.length === 0 || submit.isPending} onClick={send} className={buttonStyles.primary}>
          {submit.isPending ? "Mengirim..." : `Kirim order (${items.length} produk)`}
        </button>
      </DialogActions>
    </Dialog>
  );
}

/** ORD-04: SPG mengisi jumlah yang benar-benar diterima; bila berbeda wajib diberi keterangan. */
function ReceiveDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const action = useOrderAction();
  const showToast = useToast();
  const [values, setValues] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(order.items.map((item) => [item.id, item.shippedQty ?? 0])),
  );
  const [note, setNote] = useState("");
  const differs = order.items.some((item) => (values[item.id] ?? 0) !== (item.shippedQty ?? 0));
  const incomplete = order.items.some((item) => values[item.id] === null);

  return (
    <Dialog open onClose={onClose} title={`Terima ${order.code}`} description={`${order.pharmacy.name} · hitung barang yang datang`}>
      <div className="space-y-4">
        <OrderItems
          order={order}
          edit={{
            field: "receivedQty",
            label: "Diterima",
            values,
            onChange: (itemId, value) => setValues((current) => ({ ...current, [itemId]: value })),
          }}
        />
        {differs ? <Notice tone="red">Jumlah berbeda dari yang dikirim. Jelaskan selisihnya; Admin akan menerima tanda selisih.</Notice> : null}
        <Field label={differs ? "Keterangan selisih" : "Catatan (opsional)"}>
          <TextArea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} className="min-h-16" placeholder={differs ? "Contoh: 1 botol pecah saat diterima" : ""} />
        </Field>
        {action.error ? <Notice tone="red">{getErrorMessage(action.error)}</Notice> : null}
      </div>
      <DialogActions>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Batal
        </button>
        <button
          type="button"
          disabled={incomplete || (differs && note.trim().length < 3) || action.isPending}
          onClick={() =>
            action.mutate(
              {
                orderId: order.id,
                action: "receive",
                items: order.items.map((item) => ({ itemId: item.id, qty: values[item.id] ?? 0 })),
                note: note.trim() || undefined,
              },
              {
                onSuccess: () => {
                  showToast(`${order.code} diterima; stok Anda bertambah`);
                  onClose();
                },
              },
            )
          }
          className={buttonStyles.primary}
        >
          {action.isPending ? "Menyimpan..." : "Konfirmasi terima"}
        </button>
      </DialogActions>
    </Dialog>
  );
}

function Section({ title, orders, empty, render }: { title: string; orders: Order[]; empty?: string; render: (order: Order) => ReactNode }) {
  if (orders.length === 0 && !empty) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-subtle">{title}</h2>
      {orders.length === 0 ? <p className="text-sm text-muted">{empty}</p> : <div className="grid gap-4 xl:grid-cols-2">{orders.map(render)}</div>}
    </section>
  );
}

/** ORD-01/ORD-04 untuk SPG: ajukan order, pantau statusnya, dan konfirmasi barang diterima. */
export function OrderPage() {
  const orders = useOrders({}, { live: true });
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<Order | null>(null);
  const list = orders.data ?? [];
  const toReceive = list.filter((order) => order.status === "SHIPPED");
  const inProgress = list.filter((order) => isOpenOrder(order) && order.status !== "SHIPPED");
  const done = list.filter((order) => !isOpenOrder(order)).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Order Barang"
        description="Ajukan tambahan stok untuk apotek tugas Anda."
        actions={
          <button type="button" onClick={() => setCreating(true)} className={buttonStyles.primary}>
            <PackagePlus />
            Buat order
          </button>
        }
      />

      {!orders.data ? (
        <div className="grid place-items-center py-16">
          {orders.error ? <Notice tone="red">{getErrorMessage(orders.error)}</Notice> : <Spinner />}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={PackagePlus}>Belum ada order. Tekan “Buat order” untuk mengajukan barang.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-6">
          <Section
            title="Perlu konfirmasi terima"
            orders={toReceive}
            render={(order) => (
              <OrderCard
                key={order.id}
                order={order}
                actions={
                  <button type="button" onClick={() => setReceiving(order)} className={cn(buttonStyles.primary, "w-full sm:w-auto")}>
                    <PackageCheck />
                    Konfirmasi terima
                  </button>
                }
              />
            )}
          />
          <Section title="Sedang diproses" orders={inProgress} empty="Tidak ada order yang sedang diproses." render={(order) => <OrderCard key={order.id} order={order} />} />
          <Section title="Terakhir selesai" orders={done} render={(order) => <OrderCard key={order.id} order={order} />} />
          {list.filter((order) => !isOpenOrder(order)).length > done.length ? (
            <Link to="/riwayat-pengajuan" className="inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700">
              Lihat semua riwayat order
            </Link>
          ) : null}
        </div>
      )}

      {creating ? <NewOrderDialog onClose={() => setCreating(false)} /> : null}
      {receiving ? <ReceiveDialog order={receiving} onClose={() => setReceiving(null)} /> : null}
    </>
  );
}
