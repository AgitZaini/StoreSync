import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import * as dashboardController from "./dashboard.controller";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.get("/summary", dashboardController.getDashboardSummary);
