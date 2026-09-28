import { PharmacyStatus, Prisma, UserRole, UserStatus } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { scopeFor, spgIdFilter } from "../../utils/scope";
import { notifyUser } from "../notifications/notifications.service";
import { MAX_ACTIVE_PLACEMENTS } from "./placement.schemas";
import type { CreatePlacementInput, EndPlacementInput, ListPlacementsQuery } from "./placement.schemas";

const placementSelect = {
  id: true,
  startedAt: true,
  endedAt: true,
  endReason: true,
  spg: { select: { id: true, name: true, phone: true, team: { select: { id: true, name: true, leaderId: true } } } },
  pharmacy: { select: { id: true, name: true, address: true } },
} satisfies Prisma.PlacementSelect;

const auditSnapshot = (placement: Prisma.PlacementGetPayload<{ select: typeof placementSelect }>) => ({
  spgId: placement.spg.id,
  spgName: placement.spg.name,
  pharmacyId: placement.pharmacy.id,
  pharmacyName: placement.pharmacy.name,
  startedAt: placement.startedAt,
  endedAt: placement.endedAt,
  endReason: placement.endReason,
});

export const listPlacements = async (query: ListPlacementsQuery, actor: AuditActor) => {
  const scope = await scopeFor(actor);
  const scopeWhere: Prisma.PlacementWhereInput =
    scope.kind === "pharmacy" ? { pharmacyId: scope.pharmacyId ?? "__none__" } : { spgId: spgIdFilter(scope) };

  return prisma.placement.findMany({
    where: {
      AND: [
        scopeWhere,
        {
          spgId: query.spgId,
          pharmacyId: query.pharmacyId,
          endedAt: query.active === undefined ? undefined : query.active ? null : { not: null },
        },
      ],
    },
    select: placementSelect,
    orderBy: [{ endedAt: { sort: "desc", nulls: "first" } }, { startedAt: "desc" }],
  });
};

/** AKN-02 / BR-04: SPG maksimal di 3 apotek aktif. */
export const createPlacement = async (input: CreatePlacementInput, actor: AuditActor, context: AuditContext) => {
  const placement = await prisma.$transaction(async (tx) => {
    // Kunci baris SPG supaya dua penempatan bersamaan tidak sama-sama lolos batas 3 apotek.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.spgId} FOR UPDATE`;

    const spg = await tx.user.findUnique({
      where: { id: input.spgId },
      select: { role: true, status: true, placements: { where: { endedAt: null }, select: { pharmacyId: true } } },
    });

    if (!spg || spg.role !== UserRole.SPG) {
      throw new AppError(400, "Penempatan hanya untuk akun SPG");
    }

    if (spg.status !== UserStatus.ACTIVE) {
      throw new AppError(400, "SPG nonaktif tidak bisa ditempatkan");
    }

    const pharmacy = await tx.pharmacy.findUnique({ where: { id: input.pharmacyId }, select: { status: true } });

    if (!pharmacy) {
      throw new AppError(400, "Apotek tidak ditemukan");
    }

    if (pharmacy.status !== PharmacyStatus.ACTIVE) {
      throw new AppError(400, "SPG hanya bisa ditempatkan di apotek yang aktif");
    }

    if (spg.placements.some((active) => active.pharmacyId === input.pharmacyId)) {
      throw new AppError(409, "SPG ini sudah ditempatkan di apotek tersebut");
    }

    if (spg.placements.length >= MAX_ACTIVE_PLACEMENTS) {
      throw new AppError(
        409,
        `SPG ini sudah ditempatkan di ${MAX_ACTIVE_PLACEMENTS} apotek (batas maksimal). Lepas salah satu penempatan dulu.`,
      );
    }

    const created = await tx.placement.create({ data: input, select: placementSelect });
    await recordAudit(tx, {
      actor,
      action: "placement.create",
      entity: "Placement",
      entityId: created.id,
      after: auditSnapshot(created),
      context,
    });

    return created;
  });

  await notifyUser(
    placement.spg.id,
    "Penempatan baru",
    `Anda ditempatkan di ${placement.pharmacy.name}. Apotek ini sekarang muncul di daftar apotek tugas Anda.`,
    "/",
  );

  if (placement.spg.team) {
    await notifyUser(
      placement.spg.team.leaderId,
      "Penempatan SPG tim",
      `${placement.spg.name} ditempatkan di ${placement.pharmacy.name}.`,
      "/",
    );
  }

  return placement;
};

export const endPlacement = async (
  placementId: string,
  input: EndPlacementInput,
  actor: AuditActor,
  context: AuditContext,
) => {
  const existing = await prisma.placement.findUnique({ where: { id: placementId }, select: placementSelect });

  if (!existing) {
    throw new AppError(404, "Penempatan tidak ditemukan");
  }

  if (existing.endedAt) {
    throw new AppError(409, "Penempatan ini sudah berakhir");
  }

  // Tahap 5 menambah syarat stok kosong, Tahap 7 mewajibkan serah terima stok (SO-05).
  const placement = await prisma.$transaction(async (tx) => {
    const ended = await tx.placement.update({
      where: { id: placementId },
      data: { endedAt: new Date(), endReason: input.reason },
      select: placementSelect,
    });
    await recordAudit(tx, {
      actor,
      action: "placement.end",
      entity: "Placement",
      entityId: placementId,
      before: auditSnapshot(existing),
      after: auditSnapshot(ended),
      context,
    });
    return ended;
  });

  await notifyUser(placement.spg.id, "Penempatan berakhir", `Penempatan Anda di ${placement.pharmacy.name} sudah berakhir.`, "/");

  return placement;
};
