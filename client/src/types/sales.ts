import type { AuthUser } from "./auth";
import type { Product } from "./product";

export type PaymentMethod = "CASH" | "TRANSFER" | "QRIS" | "OTHER";

export type SalesTransactionItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  purchasePrice: string;
  total: string;
  product: Pick<Product, "id" | "name" | "sku" | "unit">;
};

export type SalesTransaction = {
  id: string;
  transactionNo: string;
  salesId: string;
  customerName?: string | null;
  paymentMethod: PaymentMethod;
  subtotal: string;
  total: string;
  transactionAt: string;
  createdAt: string;
  sales: Pick<AuthUser, "id" | "name" | "email" | "role">;
  items: SalesTransactionItem[];
};

export type SalesTransactionsResponse = {
  transactions: SalesTransaction[];
};
