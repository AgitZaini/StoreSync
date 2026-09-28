import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { hashPassword } from "../../utils/password";
import { prisma } from "../../utils/prisma";
import { notifyUser } from "../notifications/notifications.service";
import type {
  CreateUserInput,
  ListUsersQuery,
  ResetPasswordInput,
  UpdateUserInput,
  UpdateUserStatusInput,
  UpdateUserTeamInput,
} from "./user.schemas";
import { publicUserSelect, userDetailSelect, userSummarySelect } from "./user.select";

const USER_NOT_FOUND = "Pengguna tidak ditemukan";
const PHONE_TAKEN = "Nomor HP sudah dipakai akun lain";
const KASIR_MANAGED_BY_PHARMACY = "Akun kasir diubah lewat data apotek";

const revokeSessions = (tx: Prisma.TransactionClient, userId: string) =>
  tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

const findUserOrThrow = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userDetailSelect });

  if (!user) {
    throw new AppError(404, USER_NOT_FOUND);
  }

  return user;
};

const assertPhoneAvailable = async (phone: string, exceptUserId?: string) => {
  const owner = await prisma.user.findUnique({ where: { phone }, select: { id: true } });

  if (owner && owner.id !== exceptUserId) {
    throw new AppError(409, PHONE_TAKEN);
  }
};

const findTeamOrThrow = async (teamId: string) => {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, leaderId: true } });

  if (!team) {
    throw new AppError(400, "Tim tidak ditemukan");
  }

  return team;
};

/** Syarat sebelum SPG berhenti menjadi SPG aktif (ganti peran atau dinonaktifkan). */
const assertSpgReleasable = (user: { role: UserRole; placements: Array<{ endedAt: Date | null }> }) => {
  if (user.role === UserRole.SPG && user.placements.some((placement) => placement.endedAt === null)) {
    throw new AppError(409, "SPG ini masih punya penempatan aktif. Lepas semua penempatannya dulu.");
  }
};

const assertLeaderReleasable = (user: { role: UserRole; ledTeam: { name: string } | null }) => {
  if (user.role === UserRole.TEAM_LEADER && user.ledTeam) {
    throw new AppError(409, `Team Leader ini masih memimpin ${user.ledTeam.name}. Ganti leader tim itu dulu.`);
  }
};

export const listUsers = (query: ListUsersQuery) => {
  const digits = query.q?.replace(/\D/g, "");

  return prisma.user.findMany({
    where: {
      role: query.role,
      status: query.status,
      teamId: query.teamId,
      OR: query.q
        ? [
            { name: { contains: query.q, mode: "insensitive" } },
            ...(digits ? [{ phone: { contains: digits.replace(/^0/, "") } }] : []),
          ]
        : undefined,
    },
    select: userSummarySelect,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
};

export const getUser = (userId: string) => findUserOrThrow(userId);

export const createUser = async (input: CreateUserInput, actor: AuditActor, context: AuditContext) => {
  await assertPhoneAvailable(input.phone);

  if (input.teamId && input.role !== UserRole.SPG) {
    throw new AppError(400, "Hanya SPG yang bisa dimasukkan ke tim");
  }

  const team = input.teamId ? await findTeamOrThrow(input.teamId) : null;
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        phone: input.phone,
        passwordHash,
        role: input.role,
        teamId: team?.id,
        mustChangePassword: true,
      },
      select: userSummarySelect,
    });

    await recordAudit(tx, { actor, action: "user.create", entity: "User", entityId: created.id, after: created, context });

    return created;
  });

  if (team) {
    await notifyUser(team.leaderId, "Anggota tim baru", `${user.name} masuk ke ${team.name}.`, "/");
  }

  return user;
};

export const updateUser = async (userId: string, input: UpdateUserInput, actor: AuditActor, context: AuditContext) => {
  const existing = await findUserOrThrow(userId);

  if (existing.role === UserRole.KASIR) {
    throw new AppError(400, KASIR_MANAGED_BY_PHARMACY);
  }

  const roleChanged = input.role !== undefined && input.role !== existing.role;

  if (roleChanged) {
    if (userId === actor.id) {
      throw new AppError(400, "Anda tidak bisa mengubah peran akun sendiri");
    }

    assertSpgReleasable(existing);
    assertLeaderReleasable(existing);
  }

  if (input.phone && input.phone !== existing.phone) {
    await assertPhoneAvailable(input.phone, userId);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        phone: input.phone,
        role: input.role,
        // SPG yang berganti peran keluar dari timnya.
        teamId: roleChanged && existing.role === UserRole.SPG ? null : undefined,
      },
      select: publicUserSelect,
    });

    // Peran tersimpan di access token; sesi lama harus login ulang.
    if (roleChanged) {
      await revokeSessions(tx, userId);
    }

    await recordAudit(tx, {
      actor,
      action: "user.update",
      entity: "User",
      entityId: userId,
      before: { name: existing.name, phone: existing.phone, role: existing.role, teamId: existing.team?.id ?? null },
      after: { name: updated.name, phone: updated.phone, role: updated.role, ...(roleChanged && existing.team ? { teamId: null } : {}) },
      context,
    });

    return updated;
  });
};

export const updateUserStatus = async (
  userId: string,
  input: UpdateUserStatusInput,
  actor: AuditActor,
  context: AuditContext,
) => {
  if (userId === actor.id) {
    throw new AppError(400, "Anda tidak bisa mengubah status akun sendiri");
  }

  const existing = await findUserOrThrow(userId);

  if (existing.role === UserRole.KASIR) {
    throw new AppError(400, "Status akun kasir mengikuti status apoteknya");
  }

  if (input.status === UserStatus.INACTIVE) {
    assertSpgReleasable(existing);
    assertLeaderReleasable(existing);
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { status: input.status },
      select: publicUserSelect,
    });

    if (input.status === UserStatus.INACTIVE) {
      await revokeSessions(tx, userId);
    }

    await recordAudit(tx, {
      actor,
      action: "user.update_status",
      entity: "User",
      entityId: userId,
      before: { status: existing.status },
      after: { status: user.status },
      context,
    });

    return user;
  });
};

export const resetPassword = async (
  userId: string,
  input: ResetPasswordInput,
  actor: AuditActor,
  context: AuditContext,
) => {
  if (userId === actor.id) {
    throw new AppError(400, "Ganti kata sandi sendiri lewat halaman Profil");
  }

  await findUserOrThrow(userId);
  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true } });
    await revokeSessions(tx, userId);
    await recordAudit(tx, {
      actor,
      action: "user.reset_password",
      entity: "User",
      entityId: userId,
      after: { mustChangePassword: true },
      context,
    });
  });
};

export const updateUserTeam = async (
  userId: string,
  input: UpdateUserTeamInput,
  actor: AuditActor,
  context: AuditContext,
) => {
  const existing = await findUserOrThrow(userId);

  if (existing.role !== UserRole.SPG) {
    throw new AppError(400, "Hanya SPG yang bisa dimasukkan ke tim");
  }

  if (existing.status !== UserStatus.ACTIVE && input.teamId) {
    throw new AppError(400, "SPG nonaktif tidak bisa dimasukkan ke tim");
  }

  const previousTeam = existing.team ? await findTeamOrThrow(existing.team.id) : null;
  const nextTeam = input.teamId ? await findTeamOrThrow(input.teamId) : null;

  if (previousTeam?.id === nextTeam?.id) {
    return existing;
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { teamId: nextTeam?.id ?? null } });
    await recordAudit(tx, {
      actor,
      action: "user.update_team",
      entity: "User",
      entityId: userId,
      before: { teamId: previousTeam?.id ?? null, teamName: previousTeam?.name ?? null },
      after: { teamId: nextTeam?.id ?? null, teamName: nextTeam?.name ?? null },
      context,
    });

    return tx.user.findUniqueOrThrow({ where: { id: userId }, select: userDetailSelect });
  });

  if (previousTeam) {
    await notifyUser(previousTeam.leaderId, "Anggota tim keluar", `${user.name} tidak lagi di ${previousTeam.name}.`);
  }

  if (nextTeam) {
    await notifyUser(nextTeam.leaderId, "Anggota tim baru", `${user.name} masuk ke ${nextTeam.name}.`, "/");
  }

  return user;
};
