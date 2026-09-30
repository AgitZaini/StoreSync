import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import {
  approveSalesReportSchema,
  createSalesReportSchema,
  rejectSalesReportSchema,
  updateSalesReportSchema,
} from "./sales-report.schemas";
import * as salesReportsController from "./sales-reports.controller";

const { SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG, KASIR } = UserRole;

export const salesReportsRouter = Router();

salesReportsRouter.use(authenticate);

// Rute tetap didaftarkan sebelum "/:id".
salesReportsRouter.get("/pending", authorize(SUPER_ADMIN, ADMIN), salesReportsController.listPending);
salesReportsRouter.get("/performance", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG), salesReportsController.getPerformance);
salesReportsRouter.get("/", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG, KASIR), salesReportsController.listReports);
salesReportsRouter.get("/:id", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG, KASIR), salesReportsController.getReport);

// JUL-01 SPG mengirim/memperbaiki → JUL-03 kasir apotek memutuskan dengan nama + foto (AB-07).
salesReportsRouter.post("/", authorize(SPG), validateBody(createSalesReportSchema), salesReportsController.createReport);
salesReportsRouter.put("/:id", authorize(SPG), validateBody(updateSalesReportSchema), salesReportsController.updateReport);
salesReportsRouter.post("/:id/approve", authorize(KASIR), validateBody(approveSalesReportSchema), salesReportsController.approveReport);
salesReportsRouter.post("/:id/reject", authorize(KASIR), validateBody(rejectSalesReportSchema), salesReportsController.rejectReport);
