import { asyncHandler } from "../../utils/async-handler";
import { financeSummaryQuerySchema } from "./finance.schemas";
import * as financeService from "./finance.service";

export const listOperationalExpenses = asyncHandler(async (_req, res) => {
  const expenses = await financeService.listOperationalExpenses();
  res.json({ expenses });
});

export const createOperationalExpense = asyncHandler(async (req, res) => {
  const expense = await financeService.createOperationalExpense(req.body);
  res.status(201).json({ expense });
});

export const getFinanceSummary = asyncHandler(async (req, res) => {
  const summary = await financeService.getFinanceSummary(financeSummaryQuerySchema.parse(req.query));
  res.json({ summary });
});
