import { asyncHandler } from "../../utils/async-handler";
import * as notificationsService from "./notifications.service";

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await notificationsService.listNotifications(req.user!.id);
  res.json({ notifications });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  await notificationsService.markNotificationRead(getParam(req.params.id)!, req.user!.id);
  res.status(204).send();
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await notificationsService.markAllNotificationsRead(req.user!.id);
  res.status(204).send();
});
