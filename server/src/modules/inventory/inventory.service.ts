import { InventoryMutationType } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { prisma } from "../../utils/prisma";
import type { AdjustStockInput } from "./inventory.schemas";
import { notifyUsersByRole } from "../notifications/notifications.service";

export const listMutations = (productId?: string) =>
  prisma.inventoryMutation.findMany({
    where: { productId },
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
    orderBy: { createdAt: "desc" },
    take: 100,
  });

export const adjustStock = async (productId: string, input: AdjustStockInput) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new AppError(404, "Product not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: {
        stockQuantity: input.quantity,
      },
      include: {
        category: true,
      },
    });

    const delta = input.quantity - product.stockQuantity;

    await tx.inventoryMutation.create({
      data: {
        productId,
        type: InventoryMutationType.ADJUSTMENT,
        quantity: Math.abs(delta),
        previousStock: product.stockQuantity,
        currentStock: input.quantity,
        note: input.note ?? "Manual stock adjustment",
      },
    });

    return {
      ...updatedProduct,
      stockStatus:
        updatedProduct.stockQuantity <= 0
          ? "OUT"
          : updatedProduct.stockQuantity <= updatedProduct.minimumStock
            ? "LOW"
            : "SAFE",
    };
  });

  if (result.stockQuantity <= result.minimumStock) {
    await notifyUsersByRole(
      ["OWNER", "SUPERVISOR"],
      "Stok rendah",
      `${result.name} tersisa ${result.stockQuantity} ${result.unit}.`,
    );
  }

  return result;
};
