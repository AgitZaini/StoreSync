import { History, Package, PackagePlus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { buttonStyles } from "../../components/styles";
import { Card, EmptyState, Notice, PageHeader, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { cn } from "../../lib/utils";
import type { FieldStockGroup } from "../../types/stock";
import { FieldMovementsDialog, FieldStockItems } from "./field-stock-parts";
import { useFieldStock } from "./stock-api";
import { formatQty } from "./stock-labels";

/** AB-05: sisa stok SPG per apotek tugas = stok awal + order diterima − penjualan disetujui − retur. */
export function MyStockPage() {
  const stock = useFieldStock();
  const [history, setHistory] = useState<FieldStockGroup | null>(null);

  return (
    <>
      <PageHeader
        title="Stok Saya"
        description="Sisa stok di setiap apotek tugas. Bertambah saat order diterima, berkurang saat penjualan disetujui kasir."
        actions={
          <Link to="/order" className={buttonStyles.secondary}>
            <PackagePlus />
            Order barang
          </Link>
        }
      />

      {!stock.data ? (
        <div className="grid place-items-center py-16">
          {stock.error ? <Notice tone="red">{getErrorMessage(stock.error)}</Notice> : <Spinner />}
        </div>
      ) : stock.data.length === 0 ? (
        <Card>
          <EmptyState icon={Package}>Anda belum ditempatkan di apotek dan belum memegang stok.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {stock.data.map((group) => (
            <Card
              key={group.pharmacy.id}
              title={group.pharmacy.name}
              action={
                <button type="button" onClick={() => setHistory(group)} className={cn(buttonStyles.ghost, buttonStyles.small)}>
                  <History />
                  Riwayat
                </button>
              }
            >
              <p className="mb-2 text-sm text-muted">
                Total <span className="text-lg font-semibold tabular-nums text-ink">{formatQty(group.totalQty)}</span> barang
                {!group.placementId ? " · penempatan sudah berakhir" : ""}
              </p>
              <FieldStockItems group={group} />
              {!group.hasOpening && group.items.length === 0 ? (
                <p className="mt-2 text-xs text-muted">Stok awal belum diisi Admin.</p>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {history ? <FieldMovementsDialog group={history} onClose={() => setHistory(null)} /> : null}
    </>
  );
}
