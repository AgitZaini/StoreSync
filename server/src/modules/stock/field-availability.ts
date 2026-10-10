import { ReturnStatus, SalesReportStatus } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";

type Db = Prisma.TransactionClient | PrismaClient;

/** Retur yang barangnya masih di apotek: sudah diajukan tetapi belum diterima gudang atau ditolak. */
export const OPEN_RETURN_STATUSES = [ReturnStatus.SUBMITTED, ReturnStatus.KASIR_APPROVED, ReturnStatus.SA_APPROVED];

export type Availability = Map<string, { onHand: number; pendingSales: number; pendingReturns: number; available: number }>;

const sumByProduct = (items: Array<{ productId: string; qty: number }>) => {
  const totals = new Map<string, number>();
  items.forEach((item) => totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.qty));
  return totals;
};

/**
 * BR-14: stok tersedia per produk untuk satu SPG di satu apotek = sisa stok − laporan penjualan yang
 * menunggu kasir − retur yang belum diterima gudang. `exclude*` mengabaikan dokumen yang sedang diproses.
 */
export const fieldAvailability = async (
  db: Db,
  pair: { holderId: string; pharmacyId: string },
  exclude: { salesReportId?: string; returnId?: string } = {},
): Promise<Availability> => {
  const [stocks, sales, returns] = await Promise.all([
    db.fieldStock.findMany({ where: { holderId: pair.holderId, pharmacyId: pair.pharmacyId }, select: { productId: true, qty: true } }),
    db.salesReportItem.findMany({
      where: {
        report: {
          spgId: pair.holderId,
          pharmacyId: pair.pharmacyId,
          status: SalesReportStatus.SUBMITTED,
          id: exclude.salesReportId ? { not: exclude.salesReportId } : undefined,
        },
      },
      select: { productId: true, qty: true },
    }),
    db.returnItem.findMany({
      where: {
        return: {
          spgId: pair.holderId,
          pharmacyId: pair.pharmacyId,
          status: { in: OPEN_RETURN_STATUSES },
          id: exclude.returnId ? { not: exclude.returnId } : undefined,
        },
      },
      select: { productId: true, qty: true },
    }),
  ]);

  const pendingSales = sumByProduct(sales);
  const pendingReturns = sumByProduct(returns);
  const productIds = new Set([...stocks.map((stock) => stock.productId), ...pendingSales.keys(), ...pendingReturns.keys()]);
  const availability: Availability = new Map();

  productIds.forEach((productId) => {
    const onHand = stocks.find((stock) => stock.productId === productId)?.qty ?? 0;
    const sale = pendingSales.get(productId) ?? 0;
    const ret = pendingReturns.get(productId) ?? 0;
    availability.set(productId, { onHand, pendingSales: sale, pendingReturns: ret, available: onHand - sale - ret });
  });

  return availability;
};

/**
 * Menolak jumlah yang melebihi stok tersedia, dengan rincian per produk supaya bisa ditampilkan.
 * `ignoreSales` dipakai saat kasir menyetujui penjualan: laporan lain yang menunggu tidak ikut
 * mengurangi, karena yang lebih dulu disetujui yang berhak atas stoknya.
 */
export const assertWithinAvailable = (
  items: Array<{ productId: string; productName: string; qty: number }>,
  availability: Availability,
  { ignoreSales = false } = {},
) => {
  const shortages = items
    .map((item) => {
      const entry = availability.get(item.productId);
      const available = entry ? (ignoreSales ? entry.onHand - entry.pendingReturns : entry.available) : 0;
      return { productId: item.productId, productName: item.productName, requested: item.qty, available: Math.max(available, 0) };
    })
    .filter((line) => line.requested > line.available);

  if (shortages.length > 0) {
    throw new AppError(
      409,
      `Jumlah melebihi sisa stok: ${shortages.map((line) => `${line.productName} (tersedia ${line.available})`).join(", ")}`,
      "EXCEEDS_STOCK",
      { items: shortages },
    );
  }
};
