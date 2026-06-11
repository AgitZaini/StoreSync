import { asyncHandler } from "../../utils/async-handler";
import { salesTransactionQuerySchema } from "./sales.schemas";
import * as salesService from "./sales.service";

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const createSalesTransaction = asyncHandler(async (req, res) => {
  const transaction = await salesService.createSalesTransaction(req.body, req.user!);
  res.status(201).json({ transaction });
});

export const listSalesTransactions = asyncHandler(async (req, res) => {
  const transactions = await salesService.listSalesTransactions(salesTransactionQuerySchema.parse(req.query), req.user!);
  res.json({ transactions });
});

export const getSalesTransaction = asyncHandler(async (req, res) => {
  const transaction = await salesService.getSalesTransaction(getParam(req.params.id)!, req.user!);
  res.json({ transaction });
});
