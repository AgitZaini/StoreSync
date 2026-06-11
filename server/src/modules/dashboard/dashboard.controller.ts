import { asyncHandler } from "../../utils/async-handler";
import * as dashboardService from "./dashboard.service";

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const summary = await dashboardService.getDashboardSummary(req.user!);
  res.json({ summary });
});
