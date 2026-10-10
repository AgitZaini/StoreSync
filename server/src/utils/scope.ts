import { UserRole } from "@prisma/client";
import type { AuditActor } from "./audit";
import { prisma } from "./prisma";

/**
 * Batas data yang boleh dilihat pengguna (AKN-06): SPG hanya datanya sendiri, Team Leader
 * hanya timnya, Kasir hanya apoteknya, Admin dan Super Admin semua. Selalu dihitung di server.
 */
export type DataScope =
  | { kind: "all" }
  | { kind: "team"; teamId: string | null; spgIds: string[] }
  | { kind: "self"; userId: string }
  | { kind: "pharmacy"; pharmacyId: string | null };

export const scopeFor = async (actor: AuditActor): Promise<DataScope> => {
  switch (actor.role) {
    case UserRole.SUPER_ADMIN:
    case UserRole.ADMIN:
      return { kind: "all" };
    case UserRole.TEAM_LEADER: {
      const team = await prisma.team.findUnique({
        where: { leaderId: actor.id },
        select: { id: true, members: { select: { id: true } } },
      });
      return { kind: "team", teamId: team?.id ?? null, spgIds: team?.members.map((member) => member.id) ?? [] };
    }
    case UserRole.SPG:
      return { kind: "self", userId: actor.id };
    case UserRole.KASIR: {
      const pharmacy = await prisma.pharmacy.findUnique({ where: { kasirUserId: actor.id }, select: { id: true } });
      return { kind: "pharmacy", pharmacyId: pharmacy?.id ?? null };
    }
  }
};

/** Filter Prisma untuk kolom `spgId`. Kasir melihat data lewat apotek, bukan lewat SPG. */
export const spgIdFilter = (scope: DataScope): string | { in: string[] } | undefined => {
  switch (scope.kind) {
    case "all":
      return undefined;
    case "team":
      return { in: scope.spgIds };
    case "self":
      return scope.userId;
    case "pharmacy":
      return { in: [] };
  }
};

/**
 * Filter dokumen milik SPG di sebuah apotek (laporan penjualan, retur): SPG miliknya, Team Leader
 * timnya, Kasir dokumen di apoteknya (untuk disetujui), Admin dan Super Admin semua.
 */
export const spgDocumentWhere = (scope: DataScope): { spgId?: string | { in: string[] }; pharmacyId?: string } => {
  switch (scope.kind) {
    case "all":
      return {};
    case "team":
      return { spgId: { in: scope.spgIds } };
    case "self":
      return { spgId: scope.userId };
    case "pharmacy":
      return { pharmacyId: scope.pharmacyId ?? "__none__" };
  }
};
