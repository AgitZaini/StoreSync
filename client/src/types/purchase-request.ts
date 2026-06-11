import type { Product } from "./product";

export type PurchaseRequestStatus =
  | "DRAFT"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "REVISION_REQUESTED"
  | "COMPLETED";

export type PurchaseRequestItem = {
  id: string;
  productId: string;
  quantity: number;
  estimatedPrice: string;
  actualPrice?: string | null;
  product: Pick<Product, "id" | "name" | "sku" | "unit" | "stockQuantity" | "minimumStock">;
};

export type PurchaseRequest = {
  id: string;
  requestNo: string;
  status: PurchaseRequestStatus;
  supplier?: string | null;
  note?: string | null;
  ownerNote?: string | null;
  createdById: string;
  reviewedById?: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseRequestItem[];
};

export type PurchaseRequestsResponse = {
  purchaseRequests: PurchaseRequest[];
};
