import type { PaymentMethod, SalesTransaction } from "../types/sales";

export type DailySales = { date: Date; total: number; count: number };
export type WeekdayActivity = { label: string; count: number; total: number };
export type PaymentBreakdown = { method: PaymentMethod; count: number; total: number };
export type TopProduct = {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  revenue: number;
};

// Monday-first, matching the Indonesian work week.
const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
const weekdayLabels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const paymentMethods: PaymentMethod[] = ["CASH", "TRANSFER", "QRIS", "OTHER"];

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export function getDailySales(transactions: SalesTransaction[], days: number): DailySales[] {
  const buckets = new Map<string, { total: number; count: number }>();

  for (const transaction of transactions) {
    const key = dayKey(new Date(transaction.transactionAt));
    const bucket = buckets.get(key) ?? { total: 0, count: 0 };
    bucket.total += Number(transaction.total);
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const today = new Date();

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - index));
    return { date, ...(buckets.get(dayKey(date)) ?? { total: 0, count: 0 }) };
  });
}

export function getWeekdayActivity(transactions: SalesTransaction[]): WeekdayActivity[] {
  const buckets = weekdayLabels.map((label) => ({ label, count: 0, total: 0 }));

  for (const transaction of transactions) {
    const bucket = buckets[new Date(transaction.transactionAt).getDay()];
    bucket.count += 1;
    bucket.total += Number(transaction.total);
  }

  return weekdayOrder.map((day) => buckets[day]);
}

export function getPaymentBreakdown(transactions: SalesTransaction[]): PaymentBreakdown[] {
  return paymentMethods.map((method) => {
    const matches = transactions.filter((transaction) => transaction.paymentMethod === method);
    return {
      method,
      count: matches.length,
      total: matches.reduce((sum, transaction) => sum + Number(transaction.total), 0),
    };
  });
}

export function getTopProducts(transactions: SalesTransaction[], limit: number): TopProduct[] {
  const rows = new Map<string, TopProduct>();

  for (const transaction of transactions) {
    for (const item of transaction.items) {
      const row = rows.get(item.productId) ?? {
        productId: item.productId,
        name: item.product.name,
        sku: item.product.sku,
        unit: item.product.unit,
        quantity: 0,
        revenue: 0,
      };
      row.quantity += item.quantity;
      row.revenue += Number(item.total);
      rows.set(item.productId, row);
    }
  }

  return [...rows.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}
