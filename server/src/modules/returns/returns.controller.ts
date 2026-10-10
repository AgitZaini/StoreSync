import { ApprovalDecision } from "@prisma/client";
import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import { listReturnsQuerySchema } from "./return.schemas";
import * as returnsService from "./returns.service";

export const createReturn = asyncHandler(async (req, res) => {
  res.status(201).json({ return: await returnsService.createReturn(req.body, req.user!, auditContext(req)) });
});

export const listReturns = asyncHandler(async (req, res) => {
  res.json({ returns: await returnsService.listReturns(listReturnsQuerySchema.parse(req.query), req.user!) });
});

export const getReturn = asyncHandler(async (req, res) => {
  res.json({ return: await returnsService.getReturn(routeParam(req, "id"), req.user!) });
});

export const kasirApprove = asyncHandler(async (req, res) => {
  res.json({ return: await returnsService.kasirDecide(routeParam(req, "id"), ApprovalDecision.APPROVED, req.body, req.user!, auditContext(req)) });
});

export const kasirReject = asyncHandler(async (req, res) => {
  res.json({ return: await returnsService.kasirDecide(routeParam(req, "id"), ApprovalDecision.REJECTED, req.body, req.user!, auditContext(req)) });
});

export const saApprove = asyncHandler(async (req, res) => {
  res.json({ return: await returnsService.saDecide(routeParam(req, "id"), ApprovalDecision.APPROVED, req.body, req.user!, auditContext(req)) });
});

export const saReject = asyncHandler(async (req, res) => {
  res.json({ return: await returnsService.saDecide(routeParam(req, "id"), ApprovalDecision.REJECTED, req.body, req.user!, auditContext(req)) });
});

export const receiveReturn = asyncHandler(async (req, res) => {
  res.json({ return: await returnsService.receiveReturn(routeParam(req, "id"), req.body, req.user!, auditContext(req)) });
});
