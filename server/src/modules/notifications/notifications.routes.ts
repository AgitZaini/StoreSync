import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import * as notificationsController from "./notifications.controller";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

notificationsRouter.get("/", notificationsController.listNotifications);
notificationsRouter.post("/read-all", notificationsController.markAllNotificationsRead);
notificationsRouter.post("/:id/read", notificationsController.markNotificationRead);
