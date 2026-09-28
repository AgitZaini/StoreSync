import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import * as notificationsService from "./notifications.service";

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await notificationsService.listNotifications(req.user!.id);
  res.json({ notifications });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  await notificationsService.markNotificationRead(routeParam(req, "id"), req.user!.id);
  res.status(204).send();
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await notificationsService.markAllNotificationsRead(req.user!.id);
  res.status(204).send();
});
