import { useState } from "react";
import { SelectInput, TextInput } from "../../components/form-controls";
import { Card, Field, PageHeader } from "../../components/ui";
import { entityLabels } from "./audit-labels";
import type { AuditLogFilters } from "./audit-log-api";
import { AuditTimeline } from "./audit-timeline";

/** LOG-01: semua perubahan tercatat dan tidak bisa diubah atau dihapus siapa pun. */
export function AuditLogPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const setFilter = (key: keyof AuditLogFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value || undefined }));

  return (
    <>
      <PageHeader
        title="Riwayat"
        description="Siapa melakukan apa dan kapan, beserta nilai sebelum dan sesudahnya. Riwayat tidak bisa diubah atau dihapus."
      />
      <Card>
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Field label="Jenis data">
            <SelectInput value={filters.entity ?? ""} onChange={(event) => setFilter("entity", event.target.value)}>
              <option value="">Semua</option>
              {Object.entries(entityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Dari tanggal">
            <TextInput type="date" value={filters.from ?? ""} onChange={(event) => setFilter("from", event.target.value)} />
          </Field>
          <Field label="Sampai tanggal">
            <TextInput type="date" value={filters.to ?? ""} onChange={(event) => setFilter("to", event.target.value)} />
          </Field>
        </div>
        <AuditTimeline filters={filters} />
      </Card>
    </>
  );
}
