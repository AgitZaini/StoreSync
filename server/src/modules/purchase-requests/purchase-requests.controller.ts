import { asyncHandler } from "../../utils/async-handler";
import * as purchaseRequestsService from "./purchase-requests.service";

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const createPurchaseRequest = asyncHandler(async (req, res) => {
  const purchaseRequest = await purchaseRequestsService.createPurchaseRequest(req.body, req.user!);
  res.status(201).json({ purchaseRequest });
});

export const listPurchaseRequests = asyncHandler(async (req, res) => {
  const purchaseRequests = await purchaseRequestsService.listPurchaseRequests(req.user!);
  res.json({ purchaseRequests });
});

export const getPurchaseRequest = asyncHandler(async (req, res) => {
  const purchaseRequest = await purchaseRequestsService.getPurchaseRequest(getParam(req.params.id)!, req.user!);
  res.json({ purchaseRequest });
});

export const approvePurchaseRequest = asyncHandler(async (req, res) => {
  const purchaseRequest = await purchaseRequestsService.approvePurchaseRequest(getParam(req.params.id)!, req.user!, req.body);
  res.json({ purchaseRequest });
});

export const rejectPurchaseRequest = asyncHandler(async (req, res) => {
  const purchaseRequest = await purchaseRequestsService.rejectPurchaseRequest(getParam(req.params.id)!, req.user!, req.body);
  res.json({ purchaseRequest });
});

export const requestRevision = asyncHandler(async (req, res) => {
  const purchaseRequest = await purchaseRequestsService.requestRevision(getParam(req.params.id)!, req.user!, req.body);
  res.json({ purchaseRequest });
});

export const realizePurchaseRequest = asyncHandler(async (req, res) => {
  const purchaseRequest = await purchaseRequestsService.realizePurchaseRequest(getParam(req.params.id)!, req.user!, req.body);
  res.json({ purchaseRequest });
});
