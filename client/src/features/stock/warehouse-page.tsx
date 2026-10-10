import { ArrowDownToLine, ClipboardList, SlidersHorizontal, Warehouse } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Dialog, DialogActions } from "../../components/dialog";
import { QuantityInput, SelectInput, TextArea, TextInput } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { Tabs } from "../../components/tabs";
import { useToast } from "../../components/toast-context";
import { Card, DataTable, EmptyState, Field, Notice, PageHeader, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { formatBusinessDate, formatDateTime, todayDate } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { WarehouseMovementType, WarehouseStockRow } from "../../types/stock";
import { useCurrentUser } from "../auth/auth-context";
import { useAdjustWarehouse, useOrderRecap, useRecordInbound, useWarehouseMovements, useWarehouseStock } from "./stock-api";
import type { MovementFilters } from "./stock-api";
import { formatQty, formatSignedQty, WAREHOUSE_MOVEMENT } from "./stock-labels";

/** STK-01: barang masuk dari pabrik, beberapa produk sekaligus, dengan nomor PO opsional. */
function InboundDialog({ stock, onClose }: { stock: WarehouseStockRow[]; onClose: () => void }) {
  const record = useRecordInbound();
  const showToast = useToast();
  const [date, setDate] = useState(todayDate());
  const [poNumber, setPoNumber] = useState("");
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number | null>>({});
  const items = Object.entries(quantities)
    .filter(([, qty]) => qty !== null && qty > 0)
    .map(([productId, qty]) => ({ productId, qty: qty! }));

  return (
    <Dialog open onClose={onClose} title="Barang masuk" description="Stok pusat bertambah dan tercatat di riwayat mutasi." wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal masuk">
            <TextInput type="date" value={date} max={todayDate()} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Nomor PO (opsional)">
            <TextInput value={poNumber} onChange={(event) => setPoNumber(event.target.value)} maxLength={60} placeholder="PO-2026-001" />
          </Field>
        </div>
        <ul className="max-h-[40vh] divide-y divide-line overflow-y-auto rounded-xl border border-line px-3">
          {stock
            .filter((row) => row.product.isActive)
            .map((row) => (
              <li key={row.product.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{row.product.name}</span>
                  <span className="block text-xs text-muted">
                    {row.product.code} · stok sekarang {formatQty(row.qty)} {row.product.unit}
                  </span>
                </span>
                <QuantityInput
                  value={quantities[row.product.id] ?? null}
                  onChange={(value) => setQuantities((current) => ({ ...current, [row.product.id]: value }))}
                  placeholder="0"
                  aria-label={`Jumlah masuk ${row.product.name}`}
                />
              </li>
            ))}
        </ul>
        <Field label="Catatan (opsional)">
          <TextArea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} className="min-h-16" />
        </Field>
        {record.error ? <Notice tone="red">{getErrorMessage(record.error)}</Notice> : null}
      </div>
      <DialogActions>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Batal
        </button>
        <button
          type="button"
          disabled={items.length === 0 || !date || record.isPending}
          onClick={() =>
            record.mutate(
              { date, poNumber: poNumber.trim() || undefined, note: note.trim() || undefined, items },
              {
                onSuccess: () => {
                  showToast(`Barang masuk dicatat (${items.length} produk)`);
                  onClose();
                },
              },
            )
          }
          className={buttonStyles.primary}
        >
          {record.isPending ? "Menyimpan..." : `Simpan (${items.length} produk)`}
        </button>
      </DialogActions>
    </Dialog>
  );
}

/** Penyesuaian stok pusat wajib beralasan (mis. rusak, hitung ulang) dan tidak bisa membuat stok minus. */
function AdjustDialog({ stock, onClose }: { stock: WarehouseStockRow[]; onClose: () => void }) {
  const adjust = useAdjustWarehouse();
  const showToast = useToast();
  const [productId, setProductId] = useState("");
  const [direction, setDirection] = useState<"minus" | "plus">("minus");
  const [qty, setQty] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const row = stock.find((candidate) => candidate.product.id === productId);
  const signed = qty ? (direction === "minus" ? -qty : qty) : 0;
  const tooMany = row !== undefined && direction === "minus" && (qty ?? 0) > row.qty;

  return (
    <Dialog open onClose={onClose} title="Penyesuaian stok pusat" description="Untuk barang rusak, hilang, atau hasil hitung ulang. Tercatat di riwayat.">
      <div className="space-y-4">
        <Field label="Produk">
          <SelectInput value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">Pilih produk</option>
            {stock.map((candidate) => (
              <option key={candidate.product.id} value={candidate.product.id}>
                {candidate.product.name} (stok {formatQty(candidate.qty)})
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field label="Jenis">
            <SelectInput value={direction} onChange={(event) => setDirection(event.target.value as "minus" | "plus")}>
              <option value="minus">Kurangi stok</option>
              <option value="plus">Tambah stok</option>
            </SelectInput>
          </Field>
          <Field label="Jumlah">
            <QuantityInput value={qty} onChange={setQty} max={direction === "minus" ? row?.qty : undefined} className="h-11 w-24" />
          </Field>
        </div>
        {row && qty ? (
          <p className={cn("text-sm", tooMany ? "text-red-600" : "text-muted")}>
            {tooMany ? `Melebihi stok (${formatQty(row.qty)}).` : `Stok ${formatQty(row.qty)} → ${formatQty(row.qty + signed)} ${row.product.unit}`}
          </p>
        ) : null}
        <Field label="Alasan" hint="Wajib, minimal 5 karakter.">
          <TextArea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} className="min-h-16" />
        </Field>
        {adjust.error ? <Notice tone="red">{getErrorMessage(adjust.error)}</Notice> : null}
      </div>
      <DialogActions>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Batal
        </button>
        <button
          type="button"
          disabled={!productId || !qty || tooMany || reason.trim().length < 5 || adjust.isPending}
          onClick={() =>
            adjust.mutate(
              { productId, qty: signed, reason: reason.trim() },
              {
                onSuccess: () => {
                  showToast("Penyesuaian stok dicatat");
                  onClose();
                },
              },
            )
          }
          className={buttonStyles.primary}
        >
          {adjust.isPending ? "Menyimpan..." : "Simpan penyesuaian"}
        </button>
      </DialogActions>
    </Dialog>
  );
}

function StockPanel({ canEdit }: { canEdit: boolean }) {
  const stock = useWarehouseStock();
  const [dialog, setDialog] = useState<"inbound" | "adjust" | null>(null);

  if (!stock.data) {
    return (
      <div className="grid place-items-center py-16">
        {stock.error ? <Notice tone="red">{getErrorMessage(stock.error)}</Notice> : <Spinner />}
      </div>
    );
  }

  return (
    <>
      <Card
        title="Stok per produk"
        action={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setDialog("adjust")} className={cn(buttonStyles.secondary, buttonStyles.small)}>
                <SlidersHorizontal />
                Penyesuaian
              </button>
              <button type="button" onClick={() => setDialog("inbound")} className={cn(buttonStyles.primary, buttonStyles.small)}>
                <ArrowDownToLine />
                Barang masuk
              </button>
            </div>
          ) : null
        }
      >
        {stock.data.length === 0 ? (
          <EmptyState icon={Warehouse}>Belum ada produk.</EmptyState>
        ) : (
          <DataTable
            minWidth="min-w-[640px]"
            headers={["Produk", "Stok", "Dipesan (belum dikirim)", "Setelah pesanan", "Terakhir berubah"]}
            rows={stock.data.map((row) => {
              const after = row.qty - row.pendingOrderQty;
              return [
                <span key="product" className="block">
                  <span className="block">{row.product.name}</span>
                  <span className="block text-xs font-normal text-muted">
                    {row.product.code}
                    {!row.product.isActive ? " · nonaktif" : ""}
                  </span>
                </span>,
                <span key="qty" className={cn("font-semibold", row.qty === 0 ? "text-red-600" : "text-ink")}>
                  {formatQty(row.qty)} {row.product.unit}
                </span>,
                formatQty(row.pendingOrderQty),
                <span key="after" className={after < 0 ? "font-semibold text-red-600" : undefined}>
                  {after < 0 ? `kurang ${formatQty(-after)}` : formatQty(after)}
                </span>,
                row.updatedAt ? formatDateTime(row.updatedAt) : "-",
              ];
            })}
          />
        )}
      </Card>
      {dialog === "inbound" ? <InboundDialog stock={stock.data} onClose={() => setDialog(null)} /> : null}
      {dialog === "adjust" ? <AdjustDialog stock={stock.data} onClose={() => setDialog(null)} /> : null}
    </>
  );
}

function MovementsPanel() {
  const stock = useWarehouseStock();
  const [filters, setFilters] = useState<MovementFilters>({});
  const movements = useWarehouseMovements(filters);

  return (
    <Card>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectInput value={filters.productId ?? ""} onChange={(event) => setFilters((current) => ({ ...current, productId: event.target.value || undefined }))} aria-label="Filter produk">
          <option value="">Semua produk</option>
          {(stock.data ?? []).map((row) => (
            <option key={row.product.id} value={row.product.id}>
              {row.product.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          value={filters.type ?? ""}
          onChange={(event) => setFilters((current) => ({ ...current, type: (event.target.value || undefined) as WarehouseMovementType | undefined }))}
          aria-label="Filter jenis"
        >
          <option value="">Semua jenis</option>
          {(Object.keys(WAREHOUSE_MOVEMENT) as WarehouseMovementType[]).map((type) => (
            <option key={type} value={type}>
              {WAREHOUSE_MOVEMENT[type]}
            </option>
          ))}
        </SelectInput>
        <TextInput type="date" value={filters.from ?? ""} max={todayDate()} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value || undefined }))} aria-label="Dari tanggal" />
        <TextInput type="date" value={filters.to ?? ""} max={todayDate()} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value || undefined }))} aria-label="Sampai tanggal" />
      </div>
      {!movements.data ? (
        <div className="grid place-items-center py-10">
          {movements.error ? <Notice tone="red">{getErrorMessage(movements.error)}</Notice> : <Spinner />}
        </div>
      ) : (
        <DataTable
          minWidth="min-w-[760px]"
          headers={["Waktu", "Jenis", "Produk", "Jumlah", "Saldo", "Keterangan", "Oleh"]}
          rows={movements.data.map((movement) => [
            <span key="time" className="block whitespace-nowrap">
              {formatDateTime(movement.createdAt)}
              {movement.type === "INBOUND" ? <span className="block text-xs font-normal text-muted">masuk {formatBusinessDate(movement.date)}</span> : null}
            </span>,
            WAREHOUSE_MOVEMENT[movement.type],
            movement.product.name,
            <span key="qty" className={cn("font-semibold", movement.qty < 0 ? "text-red-600" : "text-green-700")}>
              {formatSignedQty(movement.qty)}
            </span>,
            formatQty(movement.balanceAfter),
            <span key="note" className="block max-w-[220px] text-xs">
              {[movement.poNumber, movement.order ? `${movement.order.code} · ${movement.order.spgName} · ${movement.order.pharmacyName}` : null, movement.note]
                .filter(Boolean)
                .join(" · ") || "-"}
            </span>,
            movement.createdBy.name,
          ])}
        />
      )}
    </Card>
  );
}

/** ORD-05: rekap permintaan belum terpenuhi per produk sebagai dasar pembelian ke pabrik. */
function RecapPanel() {
  const today = todayDate();
  const [range, setRange] = useState({ from: `${today.slice(0, 7)}-01`, to: today });
  const recap = useOrderRecap(range);

  return (
    <>
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-2 gap-3 sm:w-[360px]">
            <Field label="Dari">
              <TextInput type="date" value={range.from} max={range.to} onChange={(event) => event.target.value && setRange((current) => ({ ...current, from: event.target.value }))} />
            </Field>
            <Field label="Sampai">
              <TextInput type="date" value={range.to} min={range.from} max={today} onChange={(event) => event.target.value && setRange((current) => ({ ...current, to: event.target.value }))} />
            </Field>
          </div>
          {recap.data ? (
            <dl className="grid grid-cols-3 gap-2">
              {[
                { label: "Perlu dibeli", value: recap.data.totals.toPurchase, className: "text-red-600" },
                { label: "Diminta saat stok kurang", value: recap.data.totals.unfulfilledAtSubmitQty, className: "text-orange-600" },
                { label: "Kurang kirim", value: recap.data.totals.shortShippedQty, className: "text-ink" },
              ].map((chip) => (
                <div key={chip.label} className="rounded-xl bg-canvas px-3 py-2 text-center">
                  <dd className={cn("text-lg font-semibold tabular-nums", chip.className)}>{formatQty(chip.value)}</dd>
                  <dt className="text-[11px] text-muted">{chip.label}</dt>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted">
          “Perlu dibeli” = order yang belum dikirim dikurangi stok pusat sekarang. Kolom periode dihitung dari order yang diajukan pada rentang
          tanggal, tanpa order yang ditolak.
        </p>
      </Card>
      <Card>
        {!recap.data ? (
          <div className="grid place-items-center py-10">
            {recap.error ? <Notice tone="red">{getErrorMessage(recap.error)}</Notice> : <Spinner />}
          </div>
        ) : recap.data.rows.length === 0 ? (
          <EmptyState icon={ClipboardList}>Tidak ada permintaan yang belum terpenuhi.</EmptyState>
        ) : (
          <DataTable
            minWidth="min-w-[720px]"
            headers={["Produk", "Stok pusat", "Menunggu kirim", "Perlu dibeli", "Diminta saat stok kurang", "Kurang kirim"]}
            rows={recap.data.rows.map((row) => [
              <span key="product" className="block">
                <span className="block">{row.product.name}</span>
                <span className="block text-xs font-normal text-muted">{row.product.code}</span>
              </span>,
              formatQty(row.warehouseQty),
              `${formatQty(row.openQty)} (${row.openOrders} order)`,
              <span key="buy" className={cn("font-semibold", row.toPurchase > 0 ? "text-red-600" : "text-ink")}>
                {formatQty(row.toPurchase)} {row.product.unit}
              </span>,
              row.unfulfilledAtSubmitQty > 0 ? `${formatQty(row.unfulfilledAtSubmitQty)} (${row.unfulfilledOrders} order)` : "0",
              formatQty(row.shortShippedQty),
            ])}
          />
        )}
      </Card>
    </>
  );
}

type WarehouseTab = "stock" | "movements" | "recap";
const TAB_PARAM: Record<WarehouseTab, string | null> = { stock: null, movements: "mutasi", recap: "rekap" };

/** STK-01 + ORD-05: stok pusat, riwayat mutasi, dan rekap permintaan. Super Admin hanya melihat. */
export function WarehousePage() {
  const user = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (Object.keys(TAB_PARAM) as WarehouseTab[]).find((key) => TAB_PARAM[key] === searchParams.get("tab")) ?? "stock";

  return (
    <>
      <PageHeader title="Stok Pusat" description="Barang masuk dari pabrik, keluar untuk order, dan penyesuaian. Semua tercatat di riwayat mutasi." />
      <Tabs
        tabs={[
          { key: "stock", label: "Stok" },
          { key: "movements", label: "Mutasi" },
          { key: "recap", label: "Rekap permintaan" },
        ]}
        value={tab}
        onChange={(key) => setSearchParams(TAB_PARAM[key] ? { tab: TAB_PARAM[key]! } : {}, { replace: true })}
      />
      {tab === "stock" ? <StockPanel canEdit={user.role === "ADMIN"} /> : tab === "movements" ? <MovementsPanel /> : <RecapPanel />}
    </>
  );
}
