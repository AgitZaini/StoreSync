import { PharmacyStatus, UserRole, UserStatus } from "@prisma/client";
import type { AuditActor } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { businessDate } from "../../utils/time";
import { getMonitor } from "../attendance/attendance.service";

/** Ringkasan data utama untuk dashboard Super Admin dan Admin. Tahap berikutnya menambah omzet, absen, dsb. */
export const getOverview = async (actor: AuditActor) => {
  const month = businessDate().slice(0, 7);
  const attendanceToday = (await getMonitor(undefined, actor)).summary;
  const [usersByRole, pharmaciesByStatus, spgWithoutPlacement, spgWithoutTeam, activeProducts, activeSpg, targets] =
    await Promise.all([
      prisma.user.groupBy({ by: ["role"], where: { status: UserStatus.ACTIVE }, _count: { _all: true } }),
      prisma.pharmacy.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.user.findMany({
        where: { role: UserRole.SPG, status: UserStatus.ACTIVE, placements: { none: { endedAt: null } } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { role: UserRole.SPG, status: UserStatus.ACTIVE, teamId: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: UserRole.SPG, status: UserStatus.ACTIVE } }),
      prisma.salesTarget.aggregate({
        where: { month, spg: { status: UserStatus.ACTIVE } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

  const activeUsers = Object.fromEntries(Object.values(UserRole).map((role) => [role, 0])) as Record<UserRole, number>;
  usersByRole.forEach((group) => (activeUsers[group.role] = group._count._all));

  const pharmacies = Object.fromEntries(Object.values(PharmacyStatus).map((status) => [status, 0])) as Record<
    PharmacyStatus,
    number
  >;
  pharmaciesByStatus.forEach((group) => (pharmacies[group.status] = group._count._all));

  return {
    attendanceToday,
    activeUsers,
    pharmacies,
    activeProducts,
    spgWithoutPlacement,
    spgWithoutTeam,
    targets: {
      month,
      activeSpg,
      spgWithTarget: targets._count._all,
      totalAmount: targets._sum.amount ?? 0,
    },
  };
};
