import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { getOverview } from "./dashboard.service";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/overview",
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  asyncHandler(async (_req, res) => {
    res.json({ overview: await getOverview() });
  }),
);
