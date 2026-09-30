import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import { listSalesReportsQuerySchema, pendingQuerySchema, performanceQuerySchema } from "./sales-report.schemas";
import * as salesReportsService from "./sales-reports.service";

export const createReport = asyncHandler(async (req, res) => {
  res.status(201).json({ report: await salesReportsService.createReport(req.body, req.user!, auditContext(req)) });
});

export const updateReport = asyncHandler(async (req, res) => {
  res.json({ report: await salesReportsService.updateReport(routeParam(req, "id"), req.body, req.user!, auditContext(req)) });
});

export const approveReport = asyncHandler(async (req, res) => {
  res.json({ report: await salesReportsService.approveReport(routeParam(req, "id"), req.body, req.user!, auditContext(req)) });
});

export const rejectReport = asyncHandler(async (req, res) => {
  res.json({ report: await salesReportsService.rejectReport(routeParam(req, "id"), req.body, req.user!, auditContext(req)) });
});

export const listReports = asyncHandler(async (req, res) => {
  res.json({ reports: await salesReportsService.listReports(listSalesReportsQuerySchema.parse(req.query), req.user!) });
});

export const getReport = asyncHandler(async (req, res) => {
  res.json({ report: await salesReportsService.getReport(routeParam(req, "id"), req.user!) });
});

export const listPending = asyncHandler(async (req, res) => {
  const { olderThanDays } = pendingQuerySchema.parse(req.query);
  res.json({ reports: await salesReportsService.listPending(olderThanDays) });
});

export const getPerformance = asyncHandler(async (req, res) => {
  const { month, spgId } = performanceQuerySchema.parse(req.query);
  res.json(await salesReportsService.getPerformance(month, spgId, req.user!));
});
