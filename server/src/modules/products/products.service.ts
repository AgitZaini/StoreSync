import { UserRole } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import type { CreateProductInput, ListProductsQuery, UpdateProductInput } from "./product.schemas";

const assertCodeAvailable = async (code: string, exceptProductId?: string) => {
  const product = await prisma.product.findUnique({ where: { code }, select: { id: true } });

  if (product && product.id !== exceptProductId) {
    throw new AppError(409, "Kode produk sudah dipakai");
  }
};

const canSeeInactive = (actor: AuditActor) => actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.ADMIN;

export const listProducts = (query: ListProductsQuery, actor: AuditActor) =>
  prisma.product.findMany({
    where: query.includeInactive && canSeeInactive(actor) ? undefined : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

export const createProduct = async (input: CreateProductInput, actor: AuditActor, context: AuditContext) => {
  await assertCodeAvailable(input.code);

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: input });
    await recordAudit(tx, { actor, action: "product.create", entity: "Product", entityId: product.id, after: product, context });
    return product;
  });
};

export const updateProduct = async (
  productId: string,
  input: UpdateProductInput,
  actor: AuditActor,
  context: AuditContext,
) => {
  const existing = await prisma.product.findUnique({ where: { id: productId } });

  if (!existing) {
    throw new AppError(404, "Produk tidak ditemukan");
  }

  if (input.code) {
    await assertCodeAvailable(input.code, productId);
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.update({ where: { id: productId }, data: input });
    await recordAudit(tx, {
      actor,
      action: "product.update",
      entity: "Product",
      entityId: productId,
      before: existing,
      after: product,
      context,
    });
    return product;
  });
};
