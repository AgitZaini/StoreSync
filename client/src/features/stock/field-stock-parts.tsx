import { History } from "lucide-react";
import { Dialog, DialogActions } from "../../components/dialog";
import { buttonStyles } from "../../components/styles";
import { EmptyState, Notice, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { FieldStockGroup } from "../../types/stock";
import { useFieldMovements } from "./stock-api";
import { FIELD_MOVEMENT, formatQty, formatSignedQty } from "./stock-labels";

/** Daftar produk dan sisa stok satu pemegang di satu apotek. */
export function FieldStockItems({ group }: { group: FieldStockGroup }) {
  if (group.items.length === 0) {
    return <p className="text-sm text-subtle">Belum ada stok.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {group.items.map((item) => (
        <li key={item.product.id} className={cn("flex items-center justify-between gap-3 py-2 text-sm", item.qty === 0 && "text-subtle")}>
          <span className="min-w-0 truncate">{item.product.name}</span>
          <span className="shrink-0 tabular-nums">
            <strong className={item.qty === 0 ? "font-medium" : "font-semibold text-ink"}>{formatQty(item.qty)}</strong> {item.product.unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Riwayat ledger stok (AB-05): setiap mutasi dengan saldo sesudahnya. */
export function FieldMovementsDialog({ group, onClose }: { group: FieldStockGroup; onClose: () => void }) {
  const movements = useFieldMovements({ holderId: group.holder.id, pharmacyId: group.pharmacy.id });

  return (
    <Dialog open onClose={onClose} title="Riwayat stok" description={`${group.holder.name} · ${group.pharmacy.name}`} wide>
      {!movements.data ? (
        <div className="grid place-items-center py-10">
          {movements.error ? <Notice tone="red">{getErrorMessage(movements.error)}</Notice> : <Spinner />}
        </div>
      ) : movements.data.length === 0 ? (
        <EmptyState icon={History}>Belum ada mutasi stok.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {movements.data.map((movement) => (
            <li key={movement.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block font-medium text-ink">
                  {FIELD_MOVEMENT[movement.type]} · {movement.product.name}
                </span>
                <span className="block text-xs text-muted">
                  {formatDateTime(movement.createdAt)} · {movement.createdBy.name}
                  {movement.order ? ` · ${movement.order.code}` : ""}
                  {movement.note && movement.note !== FIELD_MOVEMENT[movement.type] ? ` · ${movement.note}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className={cn("block font-semibold", movement.qty < 0 ? "text-red-600" : "text-green-700")}>{formatSignedQty(movement.qty)}</span>
                <span className="block text-xs text-muted">sisa {formatQty(movement.balanceAfter)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <DialogActions>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Tutup
        </button>
      </DialogActions>
    </Dialog>
  );
}
