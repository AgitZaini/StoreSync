export type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  notifications: NotificationItem[];
};
