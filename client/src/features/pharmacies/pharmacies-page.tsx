import { Plus, Search, Store } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import { PharmacyStatusPill } from "../../components/badges";
import { SelectInput, TextInput } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { Card, DataTable, EmptyState, PageHeader, Pill, Spinner } from "../../components/ui";
import { formatOpeningHours, formatPhone } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { PharmacyStatus } from "../../types/master-data";
import { usePharmacies } from "./pharmacies-api";

export function PharmaciesPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PharmacyStatus | "">("ACTIVE");
  const deferredQuery = useDeferredValue(query.trim());
  const pharmacies = usePharmacies({ q: deferredQuery || undefined, status: status || undefined });

  return (
    <>
      <PageHeader
        title="Apotek"
        description="Apotek mitra, titik lokasi, radius absen, dan akun kasir."
        actions={
          <Link to="/apotek/baru" className={buttonStyles.primary}>
            <Plus />
            Daftarkan apotek
          </Link>
        }
      />

      <Card>
        <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau alamat" className="pl-10" />
          </span>
          <SelectInput value={status} onChange={(event) => setStatus(event.target.value as PharmacyStatus | "")} aria-label="Filter status">
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
            <option value="PROSPECT">Calon mitra</option>
            <option value="">Semua status</option>
          </SelectInput>
        </div>

        {pharmacies.isPending ? (
          <div className="grid place-items-center py-12">
            <Spinner />
          </div>
        ) : pharmacies.data?.length === 0 && !deferredQuery && status === "ACTIVE" ? (
          <EmptyState icon={Store}>
            Belum ada apotek aktif.
            <Link to="/apotek/baru" className={cn(buttonStyles.primary, "mt-4 flex")}>
              <Plus />
              Daftarkan apotek
            </Link>
          </EmptyState>
        ) : (
          <DataTable
            minWidth="min-w-[860px]"
            headers={["Apotek", "Jam buka", "Radius", "SPG", "Akun kasir", "Status"]}
            rows={(pharmacies.data ?? []).map((pharmacy) => [
              <Link key="name" to={`/apotek/${pharmacy.id}`} className="group block max-w-[280px]">
                <span className="block font-medium text-ink group-hover:text-brand-600">{pharmacy.name}</span>
                <span className="block truncate text-xs font-normal text-muted">{pharmacy.address}</span>
              </Link>,
              formatOpeningHours(pharmacy),
              `${pharmacy.radiusM} m`,
              pharmacy.placements.length > 0 ? (
                <span key="spg" className="block max-w-[200px] truncate">
                  {pharmacy.placements.map((placement) => placement.spg.name).join(", ")}
                </span>
              ) : (
                <span key="spg" className="text-orange-600">
                  Belum ada SPG
                </span>
              ),
              pharmacy.kasir ? (
                <span key="kasir" className="flex flex-col gap-1">
                  <span className="tabular-nums">{formatPhone(pharmacy.kasir.phone)}</span>
                  {pharmacy.kasir.mustChangePassword ? <Pill tone="orange">Belum ganti sandi</Pill> : null}
                </span>
              ) : (
                "-"
              ),
              <PharmacyStatusPill key="status" status={pharmacy.status} />,
            ])}
          />
        )}
      </Card>
    </>
  );
}
