import { asyncHandler } from "../../utils/async-handler";
import * as depositsService from "./deposits.service";

export const listDeposits = asyncHandler(async (_req, res) => {
  const deposits = await depositsService.listDeposits();
  res.json({ deposits });
});

export const createDeposit = asyncHandler(async (req, res) => {
  const deposit = await depositsService.createDeposit(req.body);
  res.status(201).json({ deposit });
});
