import { Prisma, PurchaseRequestStatus } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import type { CreateOperationalExpenseInput, FinanceSummaryQueryInput } from "./finance.schemas";

const decimalToNumber = (value: Prisma.Decimal | null | undefined) => Number(value ?? 0);

const dateWhere = (field: "transactionAt" | "expenseAt" | "depositedAt", query: FinanceSummaryQueryInput) => ({
  [field]: {
    gte: query.startDate,
    lte: query.endDate,
  },
});

export const listOperationalExpenses = () =>
  prisma.operationalExpense.findMany({
    orderBy: { expenseAt: "desc" },
    take: 100,
  });

export const createOperationalExpense = (input: CreateOperationalExpenseInput) =>
  prisma.operationalExpense.create({
    data: input,
  });

export const getFinanceSummary = async (query: FinanceSummaryQueryInput) => {
  const [salesAggregate, salesItems, realizedPurchaseItems, operationalExpenseAggregate, depositAggregate] =
    await Promise.all([
      prisma.salesTransaction.aggregate({
        where: dateWhere("transactionAt", query),
        _sum: { total: true },
        _count: true,
      }),
      prisma.salesTransactionItem.findMany({
        where: {
          salesTransaction: dateWhere("transactionAt", query),
        },
        select: {
          quantity: true,
          purchasePrice: true,
        },
      }),
      prisma.purchaseRequestItem.findMany({
        where: {
          actualPrice: { not: null },
          purchaseRequest: {
            status: PurchaseRequestStatus.COMPLETED,
            updatedAt: {
              gte: query.startDate,
              lte: query.endDate,
            },
          },
        },
        select: {
          quantity: true,
          actualPrice: true,
        },
      }),
      prisma.operationalExpense.aggregate({
        where: dateWhere("expenseAt", query),
        _sum: { amount: true },
        _count: true,
      }),
      prisma.deposit.aggregate({
        where: dateWhere("depositedAt", query),
        _sum: { amount: true },
        _count: true,
      }),
    ]);

  const salesTotal = decimalToNumber(salesAggregate._sum.total);
  const cogsTotal = salesItems.reduce(
    (sum, item) => sum + decimalToNumber(item.purchasePrice) * item.quantity,
    0,
  );
  const purchaseExpenseTotal = realizedPurchaseItems.reduce(
    (sum, item) => sum + decimalToNumber(item.actualPrice) * item.quantity,
    0,
  );
  const operationalExpenseTotal = decimalToNumber(operationalExpenseAggregate._sum.amount);
  const depositTotal = decimalToNumber(depositAggregate._sum.amount);
  const grossProfit = salesTotal - cogsTotal;
  const totalExpense = purchaseExpenseTotal + operationalExpenseTotal;
  const cashBalance = salesTotal + depositTotal - totalExpense;

  return {
    salesTotal,
    cogsTotal,
    grossProfit,
    purchaseExpenseTotal,
    operationalExpenseTotal,
    totalExpense,
    depositTotal,
    cashBalance,
    salesCount: salesAggregate._count,
    expenseCount: operationalExpenseAggregate._count,
    depositCount: depositAggregate._count,
  };
};
