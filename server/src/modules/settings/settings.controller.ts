import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import * as settingsService from "./settings.service";

export const getSettings = asyncHandler(async (_req, res) => {
  res.json({ settings: await settingsService.getSettings() });
});

export const updateLeaveQuota = asyncHandler(async (req, res) => {
  res.json({ settings: await settingsService.updateLeaveQuota(req.body, req.user!, auditContext(req)) });
});

export const addDeductionRate = asyncHandler(async (req, res) => {
  res.status(201).json({ settings: await settingsService.addDeductionRate(req.body, req.user!, auditContext(req)) });
});
