import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import { listOrdersQuerySchema, recapQuerySchema } from "./order.schemas";
import * as ordersService from "./orders.service";

export const createOrder = asyncHandler(async (req, res) => {
  res.status(201).json({ order: await ordersService.createOrder(req.body, req.user!, auditContext(req)) });
});

export const listOrders = asyncHandler(async (req, res) => {
  res.json({ orders: await ordersService.listOrders(listOrdersQuerySchema.parse(req.query), req.user!) });
});

export const getOrder = asyncHandler(async (req, res) => {
  res.json({ order: await ordersService.getOrder(routeParam(req, "id"), req.user!) });
});

export const approveOrder = asyncHandler(async (req, res) => {
  res.json({ order: await ordersService.approveOrder(routeParam(req, "id"), req.body, req.user!, auditContext(req)) });
});

export const rejectOrder = asyncHandler(async (req, res) => {
  res.json({ order: await ordersService.rejectOrder(routeParam(req, "id"), req.body.reason, req.user!, auditContext(req)) });
});

export const shipOrder = asyncHandler(async (req, res) => {
  res.json({ order: await ordersService.shipOrder(routeParam(req, "id"), req.body, req.user!, auditContext(req)) });
});

export const receiveOrder = asyncHandler(async (req, res) => {
  res.json({ order: await ordersService.receiveOrder(routeParam(req, "id"), req.body, req.user!, auditContext(req)) });
});

export const resolveDiscrepancy = asyncHandler(async (req, res) => {
  res.json({ order: await ordersService.resolveDiscrepancy(routeParam(req, "id"), req.body.note, req.user!, auditContext(req)) });
});

export const unfulfilledRecap = asyncHandler(async (req, res) => {
  res.json(await ordersService.unfulfilledRecap(recapQuerySchema.parse(req.query)));
});
