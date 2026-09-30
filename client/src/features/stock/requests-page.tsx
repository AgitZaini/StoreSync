import { History } from "lucide-react";
import { useState } from "react";
import { SelectInput } from "../../components/form-controls";
import { Card, EmptyState, Notice, PageHeader, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import type { OrderStatus } from "../../types/stock";
import { OrderCard } from "./order-parts";
import { useOrders } from "./stock-api";
import { ORDER_STATUS } from "./stock-labels";

/** Riwayat pengajuan SPG. Tahap ini berisi order; retur (Tahap 6) dan cuti (Tahap 8) menyusul. */
export function RequestsPage() {
  const [status, setStatus] = useState<OrderStatus | "">("");
  const orders = useOrders(status ? { status: [status] } : {});

  return (
    <>
      <PageHeader title="Riwayat Pengajuan" description="Status semua order Anda. Retur dan cuti akan tampil di sini setelah fiturnya tersedia." />
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
        <div className="grid place-items-center py-16">
          {orders.error ? <Notice tone="red">{getErrorMessage(orders.error)}</Notice> : <Spinner />}
        </div>
      ) : orders.data.length === 0 ? (
        <Card>
          <EmptyState icon={History}>Belum ada pengajuan.</EmptyState>
        </Card>
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
