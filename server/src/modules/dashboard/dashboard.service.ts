import { PurchaseRequestStatus, UserRole } from "@prisma/client";
import { prisma } from "../../utils/prisma";

const todayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

export const getDashboardSummary = async (actor: { id: string; role: UserRole }) => {
  const { start, end } = todayRange();

  const [
    todaySales,
    monthlySales,
    lowStockCount,
    outStockCount,
    waitingPurchaseRequests,
    latestPurchaseRequests,
    unreadNotifications,
    mySalesToday,
  ] = await Promise.all([
    prisma.salesTransaction.aggregate({
      where: { transactionAt: { gte: start, lt: end } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.salesTransaction.aggregate({
      where: {
        transactionAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _sum: { total: true },
      _count: true,
    }),
    prisma.product.count({
      where: {
        isActive: true,
        stockQuantity: { gt: 0 },
        minimumStock: { gt: 0 },
        AND: [{ stockQuantity: { lte: prisma.product.fields.minimumStock } }],
      },
    }),
    prisma.product.count({
      where: {
        isActive: true,
        stockQuantity: { lte: 0 },
      },
    }),
    prisma.purchaseRequest.count({
      where: { status: PurchaseRequestStatus.WAITING_APPROVAL },
    }),
    prisma.purchaseRequest.findMany({
      where: actor.role === UserRole.SALES ? { id: "__none__" } : undefined,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        requestNo: true,
        status: true,
        supplier: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: {
        userId: actor.id,
        readAt: null,
      },
    }),
    prisma.salesTransaction.aggregate({
      where: {
        salesId: actor.id,
        transactionAt: { gte: start, lt: end },
      },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  return {
    role: actor.role,
    todaySalesTotal: Number(todaySales._sum.total ?? 0),
    todaySalesCount: todaySales._count,
    monthlySalesTotal: Number(monthlySales._sum.total ?? 0),
    monthlySalesCount: monthlySales._count,
    lowStockCount,
    outStockCount,
    waitingPurchaseRequests,
    unreadNotifications,
    mySalesTodayTotal: Number(mySalesToday._sum.total ?? 0),
    mySalesTodayCount: mySalesToday._count,
    latestPurchaseRequests,
  };
};
