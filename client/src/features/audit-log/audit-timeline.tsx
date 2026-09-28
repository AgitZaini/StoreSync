import { History } from "lucide-react";
import { buttonStyles } from "../../components/styles";
import { EmptyState, Spinner } from "../../components/ui";
import { formatDateTime } from "../../lib/format";
import { roleLabels } from "../../lib/roles";
import type { AuditEntry } from "../../types/master-data";
import { actionLabels, auditChanges, auditSubject, entityLabels, fieldLabel, formatAuditValue } from "./audit-labels";
import { useAuditLog } from "./audit-log-api";
import type { AuditLogFilters } from "./audit-log-api";

function AuditEntryRow({ entry, showEntity }: { entry: AuditEntry; showEntity: boolean }) {
  const changes = auditChanges(entry.before, entry.after);
  const subject = auditSubject(entry.before, entry.after);
  const isUpdate = Boolean(entry.before && entry.after);

  return (
    <li className="relative pl-6">
      <span className="absolute left-0 top-1.5 size-2.5 rounded-full border-2 border-white bg-brand-500 ring-1 ring-brand-200" />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-sm font-medium text-ink">
          {actionLabels[entry.action] ?? entry.action}
          {showEntity && subject ? <span className="font-normal text-muted"> · {subject}</span> : null}
        </p>
        <time className="text-xs text-subtle tabular-nums">{formatDateTime(entry.createdAt)}</time>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {entry.actor ? `${entry.actor.name} (${roleLabels[entry.actor.role]})` : "Sistem"}
        {showEntity ? ` · ${entityLabels[entry.entity] ?? entry.entity}` : ""}
      </p>
      {changes.length > 0 ? (
        <dl className="mt-2 grid gap-1 rounded-xl bg-canvas px-3 py-2 text-xs">
          {changes.map((change) => (
            <div key={change.key} className="flex flex-wrap gap-x-2">
              <dt className="text-muted">{fieldLabel(change.key)}:</dt>
              <dd className="text-ink">
                {isUpdate ? (
                  <>
                    <span className="text-muted line-through">{formatAuditValue(change.key, change.before)}</span>
                    {" → "}
                    <span className="font-medium">{formatAuditValue(change.key, change.after)}</span>
                  </>
                ) : (
                  <span className="font-medium">{formatAuditValue(change.key, change.after ?? change.before)}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

/** Daftar riwayat (LOG-01) dengan tombol "muat lebih banyak". */
export function AuditTimeline({ filters, showEntity = true }: { filters: AuditLogFilters; showEntity?: boolean }) {
  const auditLog = useAuditLog(filters);
  const entries = auditLog.data?.pages.flatMap((page) => page.entries) ?? [];

  if (auditLog.isPending) {
    return (
      <div className="grid place-items-center py-10">
        <Spinner />
      </div>
    );
  }

  if (entries.length === 0) {
    return <EmptyState icon={History}>Belum ada riwayat untuk filter ini.</EmptyState>;
  }

  return (
    <div>
      <ol className="space-y-5 border-l border-line pl-0 [&>li]:-ml-[5px]">
        {entries.map((entry) => (
          <AuditEntryRow key={entry.id} entry={entry} showEntity={showEntity} />
        ))}
      </ol>
      {auditLog.hasNextPage ? (
        <button
          type="button"
          onClick={() => void auditLog.fetchNextPage()}
          disabled={auditLog.isFetchingNextPage}
          className={`${buttonStyles.secondary} mt-5 w-full`}
        >
          {auditLog.isFetchingNextPage ? "Memuat..." : "Muat lebih banyak"}
        </button>
      ) : null}
    </div>
  );
}
