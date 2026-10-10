import { History, Lock, PackageOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogActions } from "../../components/dialog";
import { QuantityInput, TextInput } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { useToast } from "../../components/toast-context";
import { Card, EmptyState, Notice, PageHeader, Pill, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { cn } from "../../lib/utils";
import type { FieldStockGroup } from "../../types/stock";
import { useCurrentUser } from "../auth/auth-context";
import { FieldMovementsDialog, FieldStockItems } from "./field-stock-parts";
import { useFieldStock, useSetOpeningStock, useWarehouseStock } from "./stock-api";
import { formatQty } from "./stock-labels";

/** Stok awal saat go-live per SPG per apotek; bisa diubah sampai ada transaksi stok lain (ber-riwayat). */
function OpeningDialog({ group, onClose }: { group: FieldStockGroup; onClose: () => void }) {
  const products = useWarehouseStock();
  const save = useSetOpeningStock();
  const showToast = useToast();
  const current = useMemo(() => new Map(group.items.map((item) => [item.product.id, item.qty])), [group]);
  const [values, setValues] = useState<Record<string, number | null>>(() => Object.fromEntries(current));
  const changed = Object.entries(values).filter(([productId, qty]) => qty !== null && qty !== (current.get(productId) ?? 0));

  return (
    <Dialog open onClose={onClose} title="Stok awal" description={`${group.holder.name} · ${group.pharmacy.name}`} wide>
      <div className="space-y-4">
        <Notice>Isi jumlah fisik saat mulai memakai aplikasi. Stok awal terkunci begitu ada order diterima atau penjualan disetujui.</Notice>
        {!products.data ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        ) : (
          <ul className="max-h-[45vh] divide-y divide-line overflow-y-auto rounded-xl border border-line px-3">
            {products.data.map((row) => (
              <li key={row.product.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{row.product.name}</span>
                  <span className="block text-xs text-muted">
                    {row.product.code} · sekarang {formatQty(current.get(row.product.id) ?? 0)} {row.product.unit}
                  </span>
                </span>
                <QuantityInput
                  value={values[row.product.id] ?? null}
                  onChange={(value) => setValues((state) => ({ ...state, [row.product.id]: value }))}
                  placeholder="0"
                  aria-label={`Stok awal ${row.product.name}`}
                />
              </li>
            ))}
          </ul>
        )}
        {save.error ? <Notice tone="red">{getErrorMessage(save.error)}</Notice> : null}
      </div>
      <DialogActions>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Batal
        </button>
        <button
          type="button"
          disabled={changed.length === 0 || save.isPending}
          onClick={() =>
            save.mutate(
              { spgId: group.holder.id, pharmacyId: group.pharmacy.id, items: changed.map(([productId, qty]) => ({ productId, qty: qty! })) },
              {
                onSuccess: () => {
                  showToast(`Stok awal ${group.holder.name} di ${group.pharmacy.name} disimpan`);
                  onClose();
                },
              },
            )
          }
          className={buttonStyles.primary}
        >
          {save.isPending ? "Menyimpan..." : `Simpan (${changed.length} produk)`}
        </button>
      </DialogActions>
    </Dialog>
  );
}

/** AB-05: sisa stok setiap SPG per apotek, dan stok awal go-live oleh Admin. */
export function FieldStockPage() {
  const user = useCurrentUser();
  const canEdit = user.role === "ADMIN";
  const stock = useFieldStock();
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [opening, setOpening] = useState<FieldStockGroup | null>(null);
  const [history, setHistory] = useState<FieldStockGroup | null>(null);

  const groups = (stock.data ?? []).filter((group) => {
    const query = search.trim().toLowerCase();
    const matches = !query || `${group.holder.name} ${group.pharmacy.name} ${group.holder.team?.name ?? ""}`.toLowerCase().includes(query);
    return matches && (!onlyMissing || (!group.hasOpening && group.placementId));
  });
  const missing = (stock.data ?? []).filter((group) => !group.hasOpening && group.placementId).length;

  return (
    <>
      <PageHeader title="Stok SPG" description="Sisa stok setiap SPG di apotek tugasnya: stok awal + order diterima − penjualan disetujui − retur." />
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block sm:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari SPG, apotek, atau tim" className="pl-10" />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={onlyMissing} onChange={(event) => setOnlyMissing(event.target.checked)} className="size-4 accent-brand-600" />
            Hanya yang belum ada stok awal ({missing})
          </label>
        </div>
      </Card>

      {!stock.data ? (
        <div className="grid place-items-center py-16">
          {stock.error ? <Notice tone="red">{getErrorMessage(stock.error)}</Notice> : <Spinner />}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={PackageOpen}>Tidak ada data stok yang cocok.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <Card key={`${group.holder.id}:${group.pharmacy.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{group.holder.name}</p>
                  <p className="truncate text-xs text-muted">
                    {group.pharmacy.name}
                    {group.holder.team ? ` · ${group.holder.team.name}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block text-lg font-semibold tabular-nums text-ink">{formatQty(group.totalQty)}</span>
                  <span className="block text-[11px] text-muted">barang</span>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {!group.placementId ? <Pill tone="gray">Penempatan berakhir</Pill> : null}
                {!group.hasOpening && group.placementId ? <Pill tone="orange">Stok awal belum diisi</Pill> : null}
                {group.openingLocked ? <Pill tone="gray">Stok awal terkunci</Pill> : null}
              </div>
              <div className="mt-3">
                <FieldStockItems group={group} />
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setHistory(group)} className={cn(buttonStyles.ghost, buttonStyles.small)}>
                  <History />
                  Riwayat
                </button>
                {canEdit && group.placementId ? (
                  <button
                    type="button"
                    disabled={group.openingLocked}
                    onClick={() => setOpening(group)}
                    title={group.openingLocked ? "Sudah ada transaksi stok; perubahan lewat koreksi stock opname" : undefined}
                    className={cn(buttonStyles.secondary, buttonStyles.small)}
                  >
                    {group.openingLocked ? <Lock /> : null}
                    Stok awal
                  </button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {opening ? <OpeningDialog group={opening} onClose={() => setOpening(null)} /> : null}
      {history ? <FieldMovementsDialog group={history} onClose={() => setHistory(null)} /> : null}
    </>
  );
}
