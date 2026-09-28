import { Bell, CheckCheck } from "lucide-react";
import { buttonStyles } from "../../components/styles";
import { Card, EmptyState, PageHeader, Spinner } from "../../components/ui";
import { formatDateTime } from "../../lib/format";
import { cn } from "../../lib/utils";
import { useMarkAllNotificationsRead, useNotifications } from "./notifications-api";
import { useOpenNotification } from "./use-open-notification";

export function NotificationsPage() {
  const notifications = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const openNotification = useOpenNotification();
  const items = notifications.data ?? [];
  const unreadCount = items.filter((item) => !item.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifikasi"
        description={unreadCount > 0 ? `${unreadCount} belum dibaca` : "Semua notifikasi sudah dibaca"}
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className={buttonStyles.secondary}
            >
              <CheckCheck />
              Tandai semua dibaca
            </button>
          ) : null
        }
      />

      <Card>
        {notifications.isPending ? (
          <div className="grid place-items-center py-12">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Bell}>Belum ada notifikasi. Pemberitahuan persetujuan, order, dan jadwal akan muncul di sini.</EmptyState>
        ) : (
          <div className="-mx-2 divide-y divide-line">
            {items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className={cn(
                  "flex w-full gap-3 rounded-xl px-3 py-3.5 text-left transition hover:bg-canvas",
                  !notification.readAt && "bg-brand-50/40",
                )}
              >
                <span
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", notification.readAt ? "bg-gray-200" : "bg-brand-500")}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{notification.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-muted">{notification.message}</span>
                  <span className="mt-1 block text-xs text-subtle">{formatDateTime(notification.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
