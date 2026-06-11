import { InventoryMutationType, Prisma, PurchaseRequestStatus, UserRole } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { prisma } from "../../utils/prisma";
import { notifyUser, notifyUsersByRole } from "../notifications/notifications.service";
import type {
  CreatePurchaseRequestInput,
  OwnerDecisionInput,
  RealizePurchaseRequestInput,
} from "./purchase-request.schemas";

type Actor = {
  id: string;
  role: UserRole;
};

const purchaseRequestInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          stockQuantity: true,
          minimumStock: true,
        },
      },
    },
  },
};

const createRequestNo = () => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SPP-${datePart}-${randomPart}`;
};

export const createPurchaseRequest = async (input: CreatePurchaseRequestInput, actor: Actor) => {
  const productIds = input.items.map((item) => item.productId);
  const uniqueProductIds = new Set(productIds);

  if (uniqueProductIds.size !== productIds.length) {
    throw new AppError(400, "Duplicate products are not allowed in one SPP");
  }

  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isActive: true,
    },
  });

  if (products.length !== productIds.length) {
    throw new AppError(404, "One or more products were not found");
  }

  const purchaseRequest = await prisma.purchaseRequest.create({
    data: {
      requestNo: createRequestNo(),
      status: PurchaseRequestStatus.WAITING_APPROVAL,
      supplier: input.supplier,
      note: input.note,
      createdById: actor.id,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          estimatedPrice: item.estimatedPrice,
        })),
      },
    },
    include: purchaseRequestInclude,
  });

  await notifyUsersByRole(
    [UserRole.OWNER],
    "SPP menunggu approval",
    `${purchaseRequest.requestNo} membutuhkan keputusan Pemilik.`,
  );

  return purchaseRequest;
};

export const listPurchaseRequests = (actor: Actor) => {
  if (actor.role === UserRole.SALES) {
    throw new AppError(403, "You do not have access to purchase requests");
  }

  return prisma.purchaseRequest.findMany({
    include: purchaseRequestInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
};

export const getPurchaseRequest = async (purchaseRequestId: string, actor: Actor) => {
  if (actor.role === UserRole.SALES) {
    throw new AppError(403, "You do not have access to purchase requests");
  }

  const purchaseRequest = await prisma.purchaseRequest.findUnique({
    where: { id: purchaseRequestId },
    include: purchaseRequestInclude,
  });

  if (!purchaseRequest) {
    throw new AppError(404, "Purchase request not found");
  }

  return purchaseRequest;
};

const updateOwnerDecision = async (
  purchaseRequestId: string,
  actor: Actor,
  status: PurchaseRequestStatus,
  input: OwnerDecisionInput,
) => {
  const purchaseRequest = await getPurchaseRequest(purchaseRequestId, actor);

  if (purchaseRequest.status !== PurchaseRequestStatus.WAITING_APPROVAL) {
    throw new AppError(400, "Only waiting approval SPP can receive an owner decision");
  }

  const updated = await prisma.purchaseRequest.update({
    where: { id: purchaseRequestId },
    data: {
      status,
      ownerNote: input.note,
      reviewedById: actor.id,
    },
    include: purchaseRequestInclude,
  });

  await notifyUser(
    purchaseRequest.createdById,
    `SPP ${updated.status}`,
    `${updated.requestNo} diperbarui oleh Pemilik.`,
  );

  return updated;
};

export const approvePurchaseRequest = (purchaseRequestId: string, actor: Actor, input: OwnerDecisionInput) =>
  updateOwnerDecision(purchaseRequestId, actor, PurchaseRequestStatus.APPROVED, input);

export const rejectPurchaseRequest = (purchaseRequestId: string, actor: Actor, input: OwnerDecisionInput) =>
  updateOwnerDecision(purchaseRequestId, actor, PurchaseRequestStatus.REJECTED, input);

export const requestRevision = (purchaseRequestId: string, actor: Actor, input: OwnerDecisionInput) =>
  updateOwnerDecision(purchaseRequestId, actor, PurchaseRequestStatus.REVISION_REQUESTED, input);

export const realizePurchaseRequest = async (
  purchaseRequestId: string,
  actor: Actor,
  input: RealizePurchaseRequestInput,
) => {
  const purchaseRequest = await getPurchaseRequest(purchaseRequestId, actor);

  if (purchaseRequest.status !== PurchaseRequestStatus.APPROVED) {
    throw new AppError(400, "Only approved SPP can be realized");
  }

  const itemById = new Map(purchaseRequest.items.map((item) => [item.id, item]));

  if (input.items.length !== purchaseRequest.items.length) {
    throw new AppError(400, "All SPP items must be realized");
  }

  for (const item of input.items) {
    if (!itemById.has(item.itemId)) {
      throw new AppError(400, "One or more realization items are invalid");
    }
  }

  return prisma.$transaction(async (tx) => {
    for (const realizationItem of input.items) {
      const requestItem = itemById.get(realizationItem.itemId)!;
      const product = await tx.product.findUnique({
        where: { id: requestItem.productId },
      });

      if (!product) {
        throw new AppError(404, "Product not found");
      }

      const currentStock = product.stockQuantity + requestItem.quantity;

      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: currentStock },
      });

      await tx.purchaseRequestItem.update({
        where: { id: requestItem.id },
        data: { actualPrice: new Prisma.Decimal(realizationItem.actualPrice) },
      });

      await tx.inventoryMutation.create({
        data: {
          productId: product.id,
          type: InventoryMutationType.IN,
          quantity: requestItem.quantity,
          previousStock: product.stockQuantity,
          currentStock,
          referenceId: purchaseRequestId,
          note: `Purchase realization ${purchaseRequest.requestNo}`,
        },
      });
    }

    const updated = await tx.purchaseRequest.update({
      where: { id: purchaseRequestId },
      data: {
        status: PurchaseRequestStatus.COMPLETED,
        note: input.note ?? purchaseRequest.note,
      },
      include: purchaseRequestInclude,
    });

    return updated;
  });
};
