import { useNavigate } from "react-router-dom";
import type { NotificationItem } from "../../types/notification";
import { useMarkNotificationRead } from "./notifications-api";

/** Menandai notifikasi dibaca, lalu membuka halaman terkait bila ada. */
export function useOpenNotification() {
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();

  return (notification: NotificationItem) => {
    if (!notification.readAt) {
      markRead.mutate(notification.id);
    }

    if (notification.link) {
      navigate(notification.link);
    }
  };
}
