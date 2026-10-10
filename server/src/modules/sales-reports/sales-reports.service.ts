import {
  ApprovalDecision,
  ApprovalEntity,
  FieldStockMovementType,
  PharmacyStatus,
  Prisma,
  SalesReportStatus,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { formatRupiah } from "../../utils/format";
import { prisma } from "../../utils/prisma";
import { scopeFor, spgDocumentWhere, spgIdFilter } from "../../utils/scope";
import { addBusinessDays, businessDate } from "../../utils/time";
import { lockUser } from "../attendance/attendance-checks";
import { approvalsFor, assertCashierPhotoUsable, kasirPharmacy, recordApproval } from "../approvals/cashier-approval";
import { notifyUser } from "../notifications/notifications.service";
import { assertWithinAvailable, fieldAvailability } from "../stock/field-availability";
import { applyFieldStockDelta, salesReportCode } from "../stock/stock-ledger";
import type {
  ApproveSalesReportInput,
  CreateSalesReportInput,
  ListSalesReportsQuery,
  RejectSalesReportInput,
  UpdateSalesReportInput,
} from "./sales-report.schemas";

type Tx = Prisma.TransactionClient;

const STATUS_LABEL: Record<SalesReportStatus, string> = { SUBMITTED: "menunggu kasir", APPROVED: "disetujui", REJECTED: "ditolak" };

const reportSelect = {
  id: true,
  number: true,
  reportDate: true,
  status: true,
  totalAmount: true,
  revision: true,
  note: true,
  submittedAt: true,
  decidedAt: true,
  rejectReason: true,
  spg: { select: { id: true, name: true, phone: true, team: { select: { id: true, name: true } } } },
  pharmacy: { select: { id: true, name: true, address: true, kasir: { select: { id: true, name: true, phone: true } } } },
  items: {
    select: { id: true, qty: true, unitPrice: true, subtotal: true, product: { select: { id: true, code: true, name: true, unit: true } } },
    orderBy: { product: { name: "asc" } },
  },
} satisfies Prisma.SalesReportSelect;

type ReportRow = Prisma.SalesReportGetPayload<{ select: typeof reportSelect }>;

const present = async (reports: ReportRow[]) => {
  const approvals = await approvalsFor(ApprovalEntity.SALES_REPORT, reports.map((report) => report.id));
  return reports.map((report) => ({ ...report, code: salesReportCode(report.number), approvals: approvals.get(report.id) ?? [] }));
};

const presentOne = async (report: ReportRow) => (await present([report]))[0];

/** Harga diambil dari data produk saat laporan dikirim (snapshot), omzet = jumlah × harga (JUL-01). */
const priceItems = async (items: Array<{ productId: string; qty: number }>) => {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((item) => item.productId) } },
    select: { id: true, name: true, price: true },
  });

  const lines = items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) throw new AppError(400, "Ada produk yang tidak ditemukan");
    return {
      productId: product.id,
      productName: product.name,
      qty: item.qty,
      unitPrice: product.price,
      subtotal: product.price.mul(item.qty),
    };
  });

  return { lines, total: lines.reduce((sum, line) => sum.add(line.subtotal), new Prisma.Decimal(0)) };
};

const describeLines = (lines: Array<{ productName: string; qty: number; subtotal: Prisma.Decimal }>) =>
  lines.map((line) => `${line.productName} × ${line.qty} = ${formatRupiah(line.subtotal)}`);

const notifyKasir = async (kasirUserId: string | null, title: string, message: string) => {
  if (kasirUserId) await notifyUser(kasirUserId, title, message, "/persetujuan-kasir");
};

/** JUL-01: satu laporan per SPG per apotek per hari, jumlah tidak boleh melebihi stok tersedia (BR-14). */
export const createReport = async (input: CreateSalesReportInput, actor: AuditActor, context: AuditContext) => {
  const today = businessDate();
  const reportDate = input.reportDate ?? today;

  if (reportDate !== today && reportDate !== addBusinessDays(today, -1)) {
    throw new AppError(400, "Laporan hanya bisa untuk penjualan hari ini atau kemarin");
  }

  const placement = await prisma.placement.findFirst({
    where: { spgId: actor.id, pharmacyId: input.pharmacyId, endedAt: null },
    select: { spg: { select: { name: true } }, pharmacy: { select: { id: true, name: true, status: true, kasirUserId: true } } },
  });

  if (!placement) {
    throw new AppError(403, "Anda tidak ditugaskan di apotek ini");
  }

  if (placement.pharmacy.status !== PharmacyStatus.ACTIVE) {
    throw new AppError(400, "Apotek ini sedang tidak aktif");
  }

  const { lines, total } = await priceItems(input.items);

  const report = await prisma.$transaction(async (tx) => {
    await lockUser(tx, actor.id);

    const existing = await tx.salesReport.findUnique({
      where: { spgId_pharmacyId_reportDate: { spgId: actor.id, pharmacyId: input.pharmacyId, reportDate } },
      select: { id: true },
    });

    if (existing) {
      throw new AppError(409, "Laporan tanggal ini untuk apotek ini sudah ada. Ubah laporan tersebut.", "REPORT_EXISTS", { reportId: existing.id });
    }

    assertWithinAvailable(lines, await fieldAvailability(tx, { holderId: actor.id, pharmacyId: input.pharmacyId }));

    const created = await tx.salesReport.create({
      data: {
        spgId: actor.id,
        pharmacyId: input.pharmacyId,
        reportDate,
        totalAmount: total,
        note: input.note || null,
        submittedAt: new Date(),
        items: { create: lines.map(({ productName: _name, ...line }) => line) },
      },
      select: reportSelect,
    });

    await recordAudit(tx, {
      actor,
      action: "sales_report.submit",
      entity: "SalesReport",
      entityId: created.id,
      after: {
        code: salesReportCode(created.number),
        pharmacyName: placement.pharmacy.name,
        reportDate,
        totalAmount: total,
        items: describeLines(lines),
      },
      context,
    });

    return created;
  });

  await notifyKasir(
    placement.pharmacy.kasirUserId,
    "Laporan penjualan menunggu persetujuan",
    `${placement.spg.name} mengirim laporan ${report.reportDate} senilai ${formatRupiah(total)}. Periksa dan setujui bila sesuai.`,
  );

  return presentOne(report);
};

const lockReport = async (tx: Tx, reportId: string) => {
  await tx.$queryRaw`SELECT id FROM "SalesReport" WHERE id = ${reportId} FOR UPDATE`;
  const report = await tx.salesReport.findUnique({ where: { id: reportId }, select: { ...reportSelect, pharmacy: { select: { ...reportSelect.pharmacy.select, kasirUserId: true } } } });

  if (!report) {
    throw new AppError(404, "Laporan tidak ditemukan");
  }

  return report;
};

/** SPG memperbaiki laporan yang ditolak (atau yang masih menunggu) lalu mengirim ulang; revisi bertambah. */
export const updateReport = async (reportId: string, input: UpdateSalesReportInput, actor: AuditActor, context: AuditContext) => {
  const own = await prisma.salesReport.findFirst({ where: { id: reportId, spgId: actor.id }, select: { id: true } });

  if (!own) {
    throw new AppError(404, "Laporan tidak ditemukan");
  }

  const { lines, total } = await priceItems(input.items);

  const report = await prisma.$transaction(async (tx) => {
    await lockUser(tx, actor.id);
    const current = await lockReport(tx, reportId);

    if (current.status === SalesReportStatus.APPROVED) {
      throw new AppError(409, "Laporan yang sudah disetujui kasir tidak bisa diubah (AB-06)");
    }

    assertWithinAvailable(lines, await fieldAvailability(tx, { holderId: actor.id, pharmacyId: current.pharmacy.id }, { salesReportId: current.id }));

    await tx.salesReportItem.deleteMany({ where: { reportId: current.id } });
    const updated = await tx.salesReport.update({
      where: { id: current.id },
      data: {
        totalAmount: total,
        note: input.note || null,
        revision: { increment: 1 },
        status: SalesReportStatus.SUBMITTED,
        submittedAt: new Date(),
        decidedAt: null,
        rejectReason: null,
        items: { create: lines.map(({ productName: _name, ...line }) => line) },
      },
      select: reportSelect,
    });

    await recordAudit(tx, {
      actor,
      action: "sales_report.resubmit",
      entity: "SalesReport",
      entityId: current.id,
      before: {
        code: salesReportCode(current.number),
        status: current.status,
        revision: current.revision,
        totalAmount: current.totalAmount,
        items: current.items.map((item) => `${item.product.name} × ${item.qty} = ${formatRupiah(item.subtotal)}`),
      },
      after: {
        code: salesReportCode(current.number),
        status: SalesReportStatus.SUBMITTED,
        revision: updated.revision,
        totalAmount: total,
        items: describeLines(lines),
      },
      context,
    });

    return { updated, kasirUserId: current.pharmacy.kasirUserId, wasRejected: current.status === SalesReportStatus.REJECTED };
  });

  await notifyKasir(
    report.kasirUserId,
    report.wasRejected ? "Laporan penjualan dikirim ulang" : "Laporan penjualan diperbarui",
    `${report.updated.spg.name} ${report.wasRejected ? "memperbaiki" : "mengubah"} laporan ${report.updated.reportDate} menjadi ${formatRupiah(total)}.`,
  );

  return presentOne(report.updated);
};

/** Kasir hanya memutuskan laporan di apoteknya, untuk revisi yang ia lihat, dengan foto yang belum dipakai. */
const lockPendingForKasir = async (tx: Tx, reportId: string, pharmacyId: string, revision: number, actor: AuditActor, photoFileId: string) => {
  const report = await lockReport(tx, reportId);

  if (report.pharmacy.id !== pharmacyId) {
    throw new AppError(404, "Laporan tidak ditemukan");
  }

  if (report.status !== SalesReportStatus.SUBMITTED) {
    throw new AppError(409, `Laporan ${salesReportCode(report.number)} sudah ${STATUS_LABEL[report.status]}`);
  }

  if (report.revision !== revision) {
    throw new AppError(409, "Laporan baru saja diubah SPG. Muat ulang lalu periksa lagi.", "REVISION_MISMATCH");
  }

  await assertCashierPhotoUsable(tx, actor.id, photoFileId);
  return report;
};

/**
 * JUL-03/JUL-04: kasir menyetujui dengan nama + foto. Stok dicek ulang di dalam transaksi (BR-14),
 * lalu sisa stok SPG berkurang (SALE_APPROVED) dan omzet terhitung. Setelah ini laporan terkunci (AB-06).
 */
export const approveReport = async (reportId: string, input: ApproveSalesReportInput, actor: AuditActor, context: AuditContext) => {
  const pharmacy = await kasirPharmacy(actor);

  const report = await prisma.$transaction(async (tx) => {
    const pending = await lockPendingForKasir(tx, reportId, pharmacy.id, input.revision, actor, input.cashierPhotoFileId);
    const lines = pending.items.map((item) => ({ productId: item.product.id, productName: item.product.name, qty: item.qty }));

    assertWithinAvailable(
      lines,
      await fieldAvailability(tx, { holderId: pending.spg.id, pharmacyId: pharmacy.id }, { salesReportId: pending.id }),
      { ignoreSales: true },
    );

    for (const line of lines) {
      await applyFieldStockDelta(tx, {
        holderId: pending.spg.id,
        pharmacyId: pharmacy.id,
        productId: line.productId,
        productName: line.productName,
        delta: -line.qty,
        type: FieldStockMovementType.SALE_APPROVED,
        salesReportId: pending.id,
        actorId: actor.id,
      });
    }

    await recordApproval(tx, {
      entityType: ApprovalEntity.SALES_REPORT,
      entityId: pending.id,
      step: "KASIR",
      decision: ApprovalDecision.APPROVED,
      approverId: actor.id,
      cashier: input,
    });
    const updated = await tx.salesReport.update({
      where: { id: pending.id },
      data: { status: SalesReportStatus.APPROVED, decidedAt: new Date() },
      select: reportSelect,
    });

    await recordAudit(tx, {
      actor,
      action: "sales_report.approve",
      entity: "SalesReport",
      entityId: pending.id,
      before: { code: salesReportCode(pending.number), status: pending.status },
      after: { code: salesReportCode(pending.number), status: SalesReportStatus.APPROVED, totalAmount: pending.totalAmount, cashierName: input.cashierName },
      evidenceFileIds: [input.cashierPhotoFileId],
      context,
    });

    return updated;
  });

  await notifyUser(
    report.spg.id,
    "Laporan penjualan disetujui",
    `Laporan ${report.reportDate} di ${report.pharmacy.name} (${formatRupiah(report.totalAmount)}) disetujui kasir ${input.cashierName}.`,
    "/laporan-penjualan",
  );

  return presentOne(report);
};

/** JUL-03: kasir menolak dengan nama, foto, dan alasan; laporan kembali ke SPG untuk diperbaiki. */
export const rejectReport = async (reportId: string, input: RejectSalesReportInput, actor: AuditActor, context: AuditContext) => {
  const pharmacy = await kasirPharmacy(actor);

  const report = await prisma.$transaction(async (tx) => {
    const pending = await lockPendingForKasir(tx, reportId, pharmacy.id, input.revision, actor, input.cashierPhotoFileId);

    await recordApproval(tx, {
      entityType: ApprovalEntity.SALES_REPORT,
      entityId: pending.id,
      step: "KASIR",
      decision: ApprovalDecision.REJECTED,
      reason: input.reason,
      approverId: actor.id,
      cashier: input,
    });
    const updated = await tx.salesReport.update({
      where: { id: pending.id },
      data: { status: SalesReportStatus.REJECTED, decidedAt: new Date(), rejectReason: input.reason },
      select: reportSelect,
    });

    await recordAudit(tx, {
      actor,
      action: "sales_report.reject",
      entity: "SalesReport",
      entityId: pending.id,
      before: { code: salesReportCode(pending.number), status: pending.status },
      after: { code: salesReportCode(pending.number), status: SalesReportStatus.REJECTED, reason: input.reason, cashierName: input.cashierName },
      evidenceFileIds: [input.cashierPhotoFileId],
      context,
    });

    return updated;
  });

  await notifyUser(
    report.spg.id,
    "Laporan penjualan ditolak",
    `Laporan ${report.reportDate} di ${report.pharmacy.name} ditolak kasir ${input.cashierName}: ${input.reason}. Perbaiki lalu kirim ulang.`,
    "/laporan-penjualan",
  );

  return presentOne(report);
};

const dateRange = (from?: string, to?: string) => (from || to ? { gte: from, lte: to } : undefined);

/** Daftar laporan sesuai batas akses: SPG miliknya, TL timnya, Kasir apoteknya, Admin/SA semua. */
export const listReports = async (query: ListSalesReportsQuery, actor: AuditActor) => {
  const scope = await scopeFor(actor);
  const reports = await prisma.salesReport.findMany({
    where: {
      AND: [
        spgDocumentWhere(scope),
        {
          spgId: query.spgId,
          pharmacyId: query.pharmacyId,
          status: query.status ? { in: query.status } : undefined,
          reportDate: dateRange(query.from, query.to),
        },
      ],
    },
    select: reportSelect,
    orderBy: [{ reportDate: "desc" }, { submittedAt: "desc" }],
    take: 300,
  });

  return present(reports);
};

export const getReport = async (reportId: string, actor: AuditActor) => {
  const scope = await scopeFor(actor);
  const report = await prisma.salesReport.findFirst({ where: { AND: [{ id: reportId }, spgDocumentWhere(scope)] }, select: reportSelect });

  if (!report) {
    throw new AppError(404, "Laporan tidak ditemukan");
  }

  return presentOne(report);
};

/** JUL-05: laporan yang belum diputuskan kasir lebih dari `olderThanDays` hari, supaya Admin menghubungi apotek. */
export const listPending = async (olderThanDays: number) => {
  const now = Date.now();
  const reports = await prisma.salesReport.findMany({
    where: { status: SalesReportStatus.SUBMITTED, submittedAt: { lte: new Date(now - olderThanDays * 24 * 60 * 60 * 1000) } },
    select: reportSelect,
    orderBy: { submittedAt: "asc" },
    take: 300,
  });

  return (await present(reports)).map((report) => ({
    ...report,
    hoursWaiting: Math.floor((now - report.submittedAt.getTime()) / (60 * 60 * 1000)),
  }));
};

const monthRange = (month: string) => ({ gte: `${month}-01`, lte: `${month}-31` });

/**
 * Omzet (laporan disetujui kasir) dibanding target per SPG untuk satu bulan, beserta omzet harian.
 * Laporan yang masih menunggu kasir ditampilkan terpisah dan tidak dihitung sebagai omzet (AB-06).
 */
export const getPerformance = async (month: string, spgId: string | undefined, actor: AuditActor) => {
  const scope = await scopeFor(actor);
  const scoped = spgIdFilter(scope);
  const range = monthRange(month);

  const spgs = await prisma.user.findMany({
    where: {
      role: UserRole.SPG,
      AND: [{ id: scoped }, { id: spgId }],
      OR: [{ status: UserStatus.ACTIVE }, { salesReports: { some: { reportDate: range } } }],
    },
    select: { id: true, name: true, team: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  const ids = spgs.map((spg) => spg.id);

  const [targets, approved, pending, daily] = await Promise.all([
    prisma.salesTarget.findMany({ where: { month, spgId: { in: ids } }, select: { spgId: true, amount: true } }),
    prisma.salesReport.groupBy({
      by: ["spgId"],
      where: { status: SalesReportStatus.APPROVED, reportDate: range, spgId: { in: ids } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.salesReport.groupBy({
      by: ["spgId"],
      where: { status: SalesReportStatus.SUBMITTED, reportDate: range, spgId: { in: ids } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.salesReport.groupBy({
      by: ["reportDate"],
      where: { status: SalesReportStatus.APPROVED, reportDate: range, spgId: { in: ids } },
      _sum: { totalAmount: true },
      orderBy: { reportDate: "asc" },
    }),
  ]);

  const zero = new Prisma.Decimal(0);
  const rows = spgs.map((spg) => {
    const target = targets.find((row) => row.spgId === spg.id)?.amount ?? null;
    const approvedRow = approved.find((row) => row.spgId === spg.id);
    const pendingRow = pending.find((row) => row.spgId === spg.id);
    const approvedAmount = approvedRow?._sum.totalAmount ?? zero;

    return {
      spg,
      target,
      approvedAmount,
      approvedReports: approvedRow?._count._all ?? 0,
      pendingAmount: pendingRow?._sum.totalAmount ?? zero,
      pendingReports: pendingRow?._count._all ?? 0,
      percent: target && Number(target) > 0 ? Math.round((Number(approvedAmount) / Number(target)) * 1000) / 10 : null,
    };
  });

  const sum = (values: Array<Prisma.Decimal | null>) => values.reduce<Prisma.Decimal>((total, value) => total.add(value ?? zero), zero);
  const totalTarget = sum(rows.map((row) => row.target));
  const totalApproved = sum(rows.map((row) => row.approvedAmount));

  return {
    month,
    rows,
    totals: {
      target: totalTarget,
      approvedAmount: totalApproved,
      pendingAmount: sum(rows.map((row) => row.pendingAmount)),
      percent: Number(totalTarget) > 0 ? Math.round((Number(totalApproved) / Number(totalTarget)) * 1000) / 10 : null,
    },
    daily: daily.map((row) => ({ date: row.reportDate, amount: row._sum.totalAmount ?? zero })),
  };
};

/** Ringkasan untuk Beranda Super Admin/Admin. */
export const salesSummary = async () => {
  const month = businessDate().slice(0, 7);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [approved, targets, pendingReports, overdueReports] = await Promise.all([
    prisma.salesReport.aggregate({ where: { status: SalesReportStatus.APPROVED, reportDate: monthRange(month) }, _sum: { totalAmount: true } }),
    prisma.salesTarget.aggregate({ where: { month, spg: { status: UserStatus.ACTIVE } }, _sum: { amount: true } }),
    prisma.salesReport.count({ where: { status: SalesReportStatus.SUBMITTED } }),
    prisma.salesReport.count({ where: { status: SalesReportStatus.SUBMITTED, submittedAt: { lte: dayAgo } } }),
  ]);

  return {
    month,
    approvedAmount: approved._sum.totalAmount ?? new Prisma.Decimal(0),
    targetAmount: targets._sum.amount ?? new Prisma.Decimal(0),
    pendingReports,
    overdueReports,
  };
};
