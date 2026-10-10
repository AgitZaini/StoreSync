import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { availableStockQuerySchema, fieldMovementsQuerySchema, fieldStockQuerySchema } from "./field-stock.schemas";
import * as fieldStockService from "./field-stock.service";

export const listFieldStock = asyncHandler(async (req, res) => {
  res.json({ groups: await fieldStockService.listFieldStock(fieldStockQuerySchema.parse(req.query), req.user!) });
});

export const listMovements = asyncHandler(async (req, res) => {
  res.json({ movements: await fieldStockService.listMovements(fieldMovementsQuerySchema.parse(req.query), req.user!) });
});

export const setOpeningStock = asyncHandler(async (req, res) => {
  res.json(await fieldStockService.setOpeningStock(req.body, req.user!, auditContext(req)));
});

export const listAvailableStock = asyncHandler(async (req, res) => {
  res.json({ stock: await fieldStockService.listAvailableStock(availableStockQuerySchema.parse(req.query), req.user!) });
});
