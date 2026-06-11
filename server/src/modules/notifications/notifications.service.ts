import { UserRole } from "@prisma/client";
import { prisma } from "../../utils/prisma";

export const notifyUsersByRole = async (roles: UserRole[], title: string, message: string) => {
  const users = await prisma.user.findMany({
    where: {
      role: { in: roles },
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (users.length === 0) {
    return;
  }

  await prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      title,
      message,
    })),
  });
};

export const notifyUser = async (userId: string, title: string, message: string) =>
  prisma.notification.create({
    data: {
      userId,
      title,
      message,
    },
  });

export const listNotifications = (userId: string) =>
  prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

export const markNotificationRead = (notificationId: string, userId: string) =>
  prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      readAt: new Date(),
    },
  });

export const markAllNotificationsRead = (userId: string) =>
  prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
