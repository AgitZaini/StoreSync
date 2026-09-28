import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import { listPharmaciesQuerySchema } from "./pharmacy.schemas";
import * as pharmaciesService from "./pharmacies.service";

export const listPharmacies = asyncHandler(async (req, res) => {
  const pharmacies = await pharmaciesService.listPharmacies(listPharmaciesQuerySchema.parse(req.query), req.user!);
  res.json({ pharmacies });
});

export const getPharmacy = asyncHandler(async (req, res) => {
  const pharmacy = await pharmaciesService.getPharmacy(routeParam(req, "id"), req.user!);
  res.json({ pharmacy });
});

export const createPharmacy = asyncHandler(async (req, res) => {
  const pharmacy = await pharmaciesService.createPharmacy(req.body, req.user!, auditContext(req));
  res.status(201).json({ pharmacy });
});

export const updatePharmacy = asyncHandler(async (req, res) => {
  const pharmacy = await pharmaciesService.updatePharmacy(routeParam(req, "id"), req.body, req.user!, auditContext(req));
  res.json({ pharmacy });
});

export const updatePharmacyStatus = asyncHandler(async (req, res) => {
  const pharmacy = await pharmaciesService.updatePharmacyStatus(
    routeParam(req, "id"),
    req.body,
    req.user!,
    auditContext(req),
  );
  res.json({ pharmacy });
});
