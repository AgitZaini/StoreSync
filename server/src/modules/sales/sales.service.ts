import { InventoryMutationType, Prisma, UserRole } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { prisma } from "../../utils/prisma";
import type { CreateSalesTransactionInput, SalesTransactionQueryInput } from "./sales.schemas";
import { notifyUsersByRole } from "../notifications/notifications.service";

type Actor = {
  id: string;
  role: UserRole;
};

const transactionInclude = {
  sales: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
        },
      },
    },
  },
};

const createTransactionNo = () => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SALE-${datePart}-${randomPart}`;
};

export const createSalesTransaction = async (input: CreateSalesTransactionInput, actor: Actor) => {
  const productIds = input.items.map((item) => item.productId);
  const uniqueProductIds = new Set(productIds);

  if (uniqueProductIds.size !== productIds.length) {
    throw new AppError(400, "Duplicate products are not allowed in one transaction");
  }

  const lowStockProducts: Array<{ name: string; stockQuantity: number; unit: string }> = [];

  const transaction = await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new AppError(404, "One or more products were not found");
    }

    const productById = new Map(products.map((product) => [product.id, product]));

    for (const item of input.items) {
      const product = productById.get(item.productId)!;

      if (product.stockQuantity < item.quantity) {
        throw new AppError(400, `Insufficient stock for ${product.name}`);
      }
    }

    const transactionItems = input.items.map((item) => {
      const product = productById.get(item.productId)!;
      const unitPrice = new Prisma.Decimal(product.sellingPrice);
      const total = unitPrice.mul(item.quantity);

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        purchasePrice: product.purchasePrice,
        total,
      };
    });

    const subtotal = transactionItems.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));

    const transaction = await tx.salesTransaction.create({
      data: {
        transactionNo: createTransactionNo(),
        salesId: actor.id,
        customerName: input.customerName,
        paymentMethod: input.paymentMethod,
        subtotal,
        total: subtotal,
        transactionAt: input.transactionAt ?? new Date(),
        items: {
          create: transactionItems,
        },
      },
      include: transactionInclude,
    });

    for (const item of input.items) {
      const product = productById.get(item.productId)!;
      const currentStock = product.stockQuantity - item.quantity;

      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: currentStock },
      });

      if (currentStock <= product.minimumStock) {
        lowStockProducts.push({
          name: product.name,
          stockQuantity: currentStock,
          unit: product.unit,
        });
      }

      await tx.inventoryMutation.create({
        data: {
          productId: product.id,
          type: InventoryMutationType.OUT,
          quantity: item.quantity,
          previousStock: product.stockQuantity,
          currentStock,
          referenceId: transaction.id,
          note: `Sales transaction ${transaction.transactionNo}`,
        },
      });
    }

    return transaction;
  });

  for (const product of lowStockProducts) {
    await notifyUsersByRole(
      [UserRole.OWNER, UserRole.SUPERVISOR],
      "Stok rendah setelah penjualan",
      `${product.name} tersisa ${product.stockQuantity} ${product.unit}.`,
    );
  }

  return transaction;
};

export const listSalesTransactions = async (query: SalesTransactionQueryInput, actor: Actor) => {
  const where: Prisma.SalesTransactionWhereInput = {
    salesId: actor.role === UserRole.SALES ? actor.id : query.salesId,
    transactionAt: {
      gte: query.startDate,
      lte: query.endDate,
    },
    items: query.productId
      ? {
          some: {
            productId: query.productId,
          },
        }
      : undefined,
  };

  return prisma.salesTransaction.findMany({
    where,
    include: transactionInclude,
    orderBy: { transactionAt: "desc" },
    take: 100,
  });
};

export const getSalesTransaction = async (transactionId: string, actor: Actor) => {
  const transaction = await prisma.salesTransaction.findUnique({
    where: { id: transactionId },
    include: transactionInclude,
  });

  if (!transaction) {
    throw new AppError(404, "Sales transaction not found");
  }

  if (actor.role === UserRole.SALES && transaction.salesId !== actor.id) {
    throw new AppError(403, "You do not have access to this transaction");
  }

  return transaction;
};
