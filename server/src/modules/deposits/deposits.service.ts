import { prisma } from "../../utils/prisma";
import type { CreateDepositInput } from "./deposit.schemas";

export const listDeposits = () =>
  prisma.deposit.findMany({
    orderBy: { depositedAt: "desc" },
    take: 100,
  });

export const createDeposit = (input: CreateDepositInput) =>
  prisma.deposit.create({
    data: input,
  });
