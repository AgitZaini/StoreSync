import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { movementsQuerySchema } from "./warehouse.schemas";
import * as warehouseService from "./warehouse.service";

export const listStock = asyncHandler(async (_req, res) => {
  res.json({ stock: await warehouseService.listStock() });
});

export const recordInbound = asyncHandler(async (req, res) => {
  res.status(201).json({ movements: await warehouseService.recordInbound(req.body, req.user!, auditContext(req)) });
});

export const adjustStock = asyncHandler(async (req, res) => {
  res.status(201).json({ movement: await warehouseService.adjustStock(req.body, req.user!, auditContext(req)) });
});

export const listMovements = asyncHandler(async (req, res) => {
  res.json({ movements: await warehouseService.listMovements(movementsQuerySchema.parse(req.query)) });
});
