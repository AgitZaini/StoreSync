import { UserRole } from "@prisma/client";
import { hashPassword } from "../../src/utils/password";
import { prisma } from "../../src/utils/prisma";

export const resetDatabase = async () => {
  await prisma.notification.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.inventoryMutation.deleteMany();
  await prisma.salesTransactionItem.deleteMany();
  await prisma.salesTransaction.deleteMany();
  await prisma.purchaseRequestItem.deleteMany();
  await prisma.purchaseRequest.deleteMany();
  await prisma.operationalExpense.deleteMany();
  await prisma.deposit.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
};

export const seedUsers = async () => {
  const passwordHash = await hashPassword("Password123!");

  const owner = await prisma.user.create({
    data: {
      name: "Test Owner",
      email: "owner@test.local",
      passwordHash,
      role: UserRole.OWNER,
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      name: "Test Supervisor",
      email: "supervisor@test.local",
      passwordHash,
      role: UserRole.SUPERVISOR,
    },
  });

  const sales = await prisma.user.create({
    data: {
      name: "Test Sales",
      email: "sales@test.local",
      passwordHash,
      role: UserRole.SALES,
    },
  });

  return { owner, supervisor, sales };
};

export const closeDatabase = async () => {
  await prisma.$disconnect();
};
