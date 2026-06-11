import { InventoryMutationType, Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { prisma } from "../../utils/prisma";
import type { CreateCategoryInput, CreateProductInput, ProductQueryInput, UpdateProductInput } from "./product.schemas";

const productInclude = {
  category: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
};

const getStockStatus = (stockQuantity: number, minimumStock: number) => {
  if (stockQuantity <= 0) {
    return "OUT";
  }

  if (stockQuantity <= minimumStock) {
    return "LOW";
  }

  return "SAFE";
};

const withStockStatus = <T extends { stockQuantity: number; minimumStock: number }>(product: T) => ({
  ...product,
  stockStatus: getStockStatus(product.stockQuantity, product.minimumStock),
});

export const listCategories = () =>
  prisma.productCategory.findMany({
    orderBy: { name: "asc" },
  });

export const createCategory = async (input: CreateCategoryInput) => {
  const existing = await prisma.productCategory.findUnique({
    where: { name: input.name },
  });

  if (existing) {
    throw new AppError(409, "Category already exists");
  }

  return prisma.productCategory.create({
    data: { name: input.name },
  });
};

export const listProducts = async (query: ProductQueryInput) => {
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    categoryId: query.categoryId,
    OR: query.search
      ? [
          { name: { contains: query.search, mode: "insensitive" } },
          { sku: { contains: query.search, mode: "insensitive" } },
        ]
      : undefined,
  };

  const products = await prisma.product.findMany({
    where,
    include: productInclude,
    orderBy: { name: "asc" },
  });

  const productsWithStatus = products.map(withStockStatus);

  if (!query.stockStatus) {
    return productsWithStatus;
  }

  return productsWithStatus.filter((product) => product.stockStatus === query.stockStatus);
};

export const getProduct = async (productId: string) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: productInclude,
  });

  if (!product) {
    throw new AppError(404, "Product not found");
  }

  return withStockStatus(product);
};

export const createProduct = async (input: CreateProductInput, actorId: string) => {
  const existingSku = await prisma.product.findUnique({
    where: { sku: input.sku },
  });

  if (existingSku) {
    throw new AppError(409, "SKU is already used");
  }

  if (input.categoryId) {
    const category = await prisma.productCategory.findUnique({
      where: { id: input.categoryId },
    });

    if (!category) {
      throw new AppError(404, "Category not found");
    }
  }

  const product = await prisma.$transaction(async (tx) => {
    const createdProduct = await tx.product.create({
      data: {
        ...input,
        sku: input.sku.toUpperCase(),
        createdById: actorId,
      },
      include: productInclude,
    });

    if (input.stockQuantity > 0) {
      await tx.inventoryMutation.create({
        data: {
          productId: createdProduct.id,
          type: InventoryMutationType.IN,
          quantity: input.stockQuantity,
          previousStock: 0,
          currentStock: input.stockQuantity,
          note: "Initial product stock",
        },
      });
    }

    return createdProduct;
  });

  return withStockStatus(product);
};

export const updateProduct = async (productId: string, input: UpdateProductInput) => {
  await getProduct(productId);

  if (input.categoryId) {
    const category = await prisma.productCategory.findUnique({
      where: { id: input.categoryId },
    });

    if (!category) {
      throw new AppError(404, "Category not found");
    }
  }

  if (input.sku) {
    const existingSku = await prisma.product.findFirst({
      where: {
        sku: input.sku.toUpperCase(),
        NOT: { id: productId },
      },
    });

    if (existingSku) {
      throw new AppError(409, "SKU is already used");
    }
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      ...input,
      sku: input.sku?.toUpperCase(),
    },
    include: productInclude,
  });

  return withStockStatus(product);
};
