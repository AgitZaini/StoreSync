import { ArrowRight, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, EmptyState, PageHeader, Pill } from "../../components/ui";
import { formatDateTime, formatLongDate, formatPhone, getGreeting } from "../../lib/format";
import { roleLabels } from "../../lib/roles";
import { roleNavigation } from "../../routes/navigation";
import type { NavEntry } from "../../routes/navigation";
import { useCurrentUser } from "../auth/auth-context";
import { useNotifications } from "../notifications/notifications-api";
import { useOpenNotification } from "../notifications/use-open-notification";
import { RoleSummary } from "./role-summary";

function MenuTile({ entry }: { entry: NavEntry }) {
  const available = entry.availableIn === undefined;
  const content = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 group-aria-disabled:bg-canvas group-aria-disabled:text-subtle">
        <entry.icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-semibold text-ink">{entry.label}</span>
          {available ? <ArrowRight className="size-4 shrink-0 text-subtle" /> : <Pill tone="gray">Segera</Pill>}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">{entry.description}</span>
      </span>
    </>
  );
  const className = "group flex min-w-0 gap-3 rounded-2xl border border-line p-4 transition";

  return available ? (
    <Link to={entry.path} className={`${className} hover:border-brand-200 hover:bg-brand-50/40`}>
      {content}
    </Link>
  ) : (
    <div aria-disabled="true" title={`Tersedia di tahap ${entry.availableIn}`} className={className}>
      {content}
    </div>
  );
}

export function DashboardPage() {
  const user = useCurrentUser();
  const notifications = useNotifications();
  const openNotification = useOpenNotification();
  const entries = roleNavigation[user.role];
  const menus = entries.slice(1);
  const latestNotifications = (notifications.data ?? []).slice(0, 4);
  const firstName = user.name.split(/\s+/)[0];

  return (
    <>
      <PageHeader
        title={`${getGreeting()}, ${firstName}`}
        description={`${roleLabels[user.role]} · ${formatLongDate(new Date())}`}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="min-w-0 space-y-5">
          <RoleSummary user={user} />

          <Card title={`Menu ${roleLabels[user.role]}`}>
            <div className="grid gap-3 sm:grid-cols-2">
              {menus.map((entry) => (
                <MenuTile key={entry.key} entry={entry} />
              ))}
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card
            title="Notifikasi terbaru"
            action={
              <Link to="/notifikasi" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                Lihat semua
              </Link>
            }
          >
            {latestNotifications.length === 0 ? (
              <EmptyState icon={Bell}>Belum ada notifikasi.</EmptyState>
            ) : (
              <div className="-mx-2 divide-y divide-line">
                {latestNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="flex w-full gap-3 rounded-xl px-2 py-3 text-left hover:bg-canvas"
                  >
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.readAt ? "bg-gray-200" : "bg-brand-500"}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{notification.title}</span>
                      <span className="mt-0.5 block text-[11px] text-subtle">{formatDateTime(notification.createdAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title="Akun">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Nomor HP</dt>
                <dd className="font-medium text-ink tabular-nums">{formatPhone(user.phone)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Peran</dt>
                <dd className="font-medium text-ink">{roleLabels[user.role]}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Login terakhir</dt>
                <dd className="text-right font-medium text-ink">
                  {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "-"}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
