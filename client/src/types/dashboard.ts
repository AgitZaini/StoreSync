import type { UserRole } from "./auth";
import type { PurchaseRequestStatus } from "./purchase-request";

export type DashboardSummary = {
  role: UserRole;
  todaySalesTotal: number;
  todaySalesCount: number;
  monthlySalesTotal: number;
  monthlySalesCount: number;
  lowStockCount: number;
  outStockCount: number;
  waitingPurchaseRequests: number;
  unreadNotifications: number;
  mySalesTodayTotal: number;
  mySalesTodayCount: number;
  latestPurchaseRequests: Array<{
    id: string;
    requestNo: string;
    status: PurchaseRequestStatus;
    supplier?: string | null;
    createdAt: string;
  }>;
};

export type DashboardSummaryResponse = {
  summary: DashboardSummary;
};
