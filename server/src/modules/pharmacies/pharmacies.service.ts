import { PharmacyStatus, Prisma, UserRole, UserStatus } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { hashPassword } from "../../utils/password";
import { prisma } from "../../utils/prisma";
import { scopeFor } from "../../utils/scope";
import { OPENING_HOURS_MESSAGE, validateOpeningHours } from "./pharmacy.schemas";
import type {
  CreatePharmacyInput,
  ListPharmaciesQuery,
  UpdatePharmacyInput,
  UpdatePharmacyStatusInput,
} from "./pharmacy.schemas";

const PHARMACY_NOT_FOUND = "Apotek tidak ditemukan";

const basePharmacySelect = {
  id: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  radiusM: true,
  is24h: true,
  openTime: true,
  closeTime: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PharmacySelect;

// Akun kasir dan daftar SPG yang ditempatkan hanya untuk Admin dan Super Admin.
const managedPharmacySelect = {
  ...basePharmacySelect,
  kasir: { select: { id: true, name: true, phone: true, status: true, mustChangePassword: true, lastLoginAt: true } },
  placements: {
    where: { endedAt: null },
    orderBy: { startedAt: "asc" },
    select: { id: true, startedAt: true, spg: { select: { id: true, name: true, phone: true } } },
  },
} satisfies Prisma.PharmacySelect;

const kasirName = (pharmacyName: string) => `Kasir ${pharmacyName}`;

const snapshot = (pharmacy: Prisma.PharmacyGetPayload<{ select: typeof managedPharmacySelect }>) => ({
  name: pharmacy.name,
  address: pharmacy.address,
  latitude: pharmacy.latitude,
  longitude: pharmacy.longitude,
  radiusM: pharmacy.radiusM,
  is24h: pharmacy.is24h,
  openTime: pharmacy.openTime,
  closeTime: pharmacy.closeTime,
  status: pharmacy.status,
  kasirPhone: pharmacy.kasir?.phone ?? null,
});

const assertPhoneAvailable = async (phone: string, exceptUserId?: string | null) => {
  const owner = await prisma.user.findUnique({ where: { phone }, select: { id: true } });

  if (owner && owner.id !== exceptUserId) {
    throw new AppError(409, "Nomor HP sudah dipakai akun lain");
  }
};

/** Filter apotek sesuai peran (AKN-06). */
const pharmacyScopeWhere = async (actor: AuditActor): Promise<Prisma.PharmacyWhereInput> => {
  const scope = await scopeFor(actor);

  switch (scope.kind) {
    case "all":
      return {};
    case "team":
      // Team Leader mengunjungi semua apotek aktif (ABS-02).
      return { status: PharmacyStatus.ACTIVE };
    case "self":
      return { placements: { some: { spgId: scope.userId, endedAt: null } } };
    case "pharmacy":
      return { id: scope.pharmacyId ?? "__none__" };
  }
};

const isManager = (actor: AuditActor) => actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.ADMIN;

export const listPharmacies = async (query: ListPharmaciesQuery, actor: AuditActor) => {
  const where: Prisma.PharmacyWhereInput = {
    AND: [
      await pharmacyScopeWhere(actor),
      {
        status: query.status,
        OR: query.q
          ? [
              { name: { contains: query.q, mode: "insensitive" } },
              { address: { contains: query.q, mode: "insensitive" } },
            ]
          : undefined,
      },
    ],
  };
  const orderBy = [{ status: "asc" }, { name: "asc" }] satisfies Prisma.PharmacyOrderByWithRelationInput[];

  return isManager(actor)
    ? prisma.pharmacy.findMany({ where, select: managedPharmacySelect, orderBy })
    : prisma.pharmacy.findMany({ where, select: basePharmacySelect, orderBy });
};

export const getPharmacy = async (pharmacyId: string, actor: AuditActor) => {
  const where = { AND: [{ id: pharmacyId }, await pharmacyScopeWhere(actor)] };
  const pharmacy = isManager(actor)
    ? await prisma.pharmacy.findFirst({ where, select: managedPharmacySelect })
    : await prisma.pharmacy.findFirst({ where, select: basePharmacySelect });

  if (!pharmacy) {
    throw new AppError(404, PHARMACY_NOT_FOUND);
  }

  return pharmacy;
};

const findManagedOrThrow = async (pharmacyId: string) => {
  const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId }, select: managedPharmacySelect });

  if (!pharmacy) {
    throw new AppError(404, PHARMACY_NOT_FOUND);
  }

  return pharmacy;
};

/** AKN-03: setiap apotek otomatis punya satu akun Kasir Apotek (dipakai bersama). */
export const createPharmacy = async (input: CreatePharmacyInput, actor: AuditActor, context: AuditContext) => {
  await assertPhoneAvailable(input.kasirPhone);
  const passwordHash = await hashPassword(input.kasirPassword);
  const { kasirPhone, kasirPassword: _kasirPassword, ...fields } = input;

  return prisma.$transaction(async (tx) => {
    const kasir = await tx.user.create({
      data: {
        name: kasirName(input.name),
        phone: kasirPhone,
        passwordHash,
        role: UserRole.KASIR,
        mustChangePassword: true,
      },
      select: { id: true, name: true, phone: true, role: true },
    });

    const pharmacy = await tx.pharmacy.create({
      data: {
        ...fields,
        openTime: fields.is24h ? null : fields.openTime,
        closeTime: fields.is24h ? null : fields.closeTime,
        status: PharmacyStatus.ACTIVE,
        kasirUserId: kasir.id,
      },
      select: managedPharmacySelect,
    });

    await recordAudit(tx, { actor, action: "user.create", entity: "User", entityId: kasir.id, after: kasir, context });
    await recordAudit(tx, {
      actor,
      action: "pharmacy.create",
      entity: "Pharmacy",
      entityId: pharmacy.id,
      after: snapshot(pharmacy),
      context,
    });

    return pharmacy;
  });
};

export const updatePharmacy = async (
  pharmacyId: string,
  input: UpdatePharmacyInput,
  actor: AuditActor,
  context: AuditContext,
) => {
  const existing = await findManagedOrThrow(pharmacyId);
  const is24h = input.is24h ?? existing.is24h;
  const hours = {
    is24h,
    openTime: is24h ? null : input.openTime !== undefined ? input.openTime : existing.openTime,
    closeTime: is24h ? null : input.closeTime !== undefined ? input.closeTime : existing.closeTime,
  };

  if (!validateOpeningHours(hours)) {
    throw new AppError(400, OPENING_HOURS_MESSAGE);
  }

  const kasirPhoneChanged = input.kasirPhone !== undefined && input.kasirPhone !== existing.kasir?.phone;

  if (kasirPhoneChanged) {
    await assertPhoneAvailable(input.kasirPhone!, existing.kasir?.id);
  }

  const { kasirPhone, ...fields } = input;

  return prisma.$transaction(async (tx) => {
    if (existing.kasir && (kasirPhoneChanged || (input.name && input.name !== existing.name))) {
      await tx.user.update({
        where: { id: existing.kasir.id },
        data: { phone: kasirPhoneChanged ? kasirPhone : undefined, name: input.name ? kasirName(input.name) : undefined },
      });
    }

    const pharmacy = await tx.pharmacy.update({
      where: { id: pharmacyId },
      data: { ...fields, ...hours },
      select: managedPharmacySelect,
    });

    await recordAudit(tx, {
      actor,
      action: "pharmacy.update",
      entity: "Pharmacy",
      entityId: pharmacyId,
      before: snapshot(existing),
      after: snapshot(pharmacy),
      context,
    });

    return pharmacy;
  });
};

export const updatePharmacyStatus = async (
  pharmacyId: string,
  input: UpdatePharmacyStatusInput,
  actor: AuditActor,
  context: AuditContext,
) => {
  const existing = await findManagedOrThrow(pharmacyId);

  if (existing.status === input.status) {
    return existing;
  }

  if (existing.status === PharmacyStatus.PROSPECT) {
    throw new AppError(400, "Calon mitra diaktifkan lewat persetujuan MOU");
  }

  if (input.status === PharmacyStatus.INACTIVE && existing.placements.length > 0) {
    throw new AppError(409, "Masih ada SPG yang ditempatkan di apotek ini. Lepas penempatannya dulu.");
  }

  return prisma.$transaction(async (tx) => {
    if (existing.kasir) {
      const kasirStatus = input.status === PharmacyStatus.ACTIVE ? UserStatus.ACTIVE : UserStatus.INACTIVE;
      await tx.user.update({ where: { id: existing.kasir.id }, data: { status: kasirStatus } });

      if (kasirStatus === UserStatus.INACTIVE) {
        await tx.refreshToken.updateMany({
          where: { userId: existing.kasir.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }

    const pharmacy = await tx.pharmacy.update({
      where: { id: pharmacyId },
      data: { status: input.status },
      select: managedPharmacySelect,
    });

    await recordAudit(tx, {
      actor,
      action: "pharmacy.update_status",
      entity: "Pharmacy",
      entityId: pharmacyId,
      before: { status: existing.status },
      after: { status: pharmacy.status },
      context,
    });

    return pharmacy;
  });
};
