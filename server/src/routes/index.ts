import { Router } from "express";
import { healthRouter } from "./health.routes";
import { authRouter } from "../modules/auth/auth.routes";
import { filesRouter } from "../modules/files/files.routes";
import { notificationsRouter } from "../modules/notifications/notifications.routes";
import { usersRouter } from "../modules/users/users.routes";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/files", filesRouter);
apiRouter.use("/notifications", notificationsRouter);
