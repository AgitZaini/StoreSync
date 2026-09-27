import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { listAuditLogs, listAuditLogsQuerySchema } from "./audit-logs.service";

export const auditLogsRouter = Router();

// LOG-01: riwayat hanya dibaca Super Admin dan tidak punya endpoint ubah/hapus.
auditLogsRouter.get(
  "/",
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    res.json(await listAuditLogs(listAuditLogsQuerySchema.parse(req.query)));
  }),
);
