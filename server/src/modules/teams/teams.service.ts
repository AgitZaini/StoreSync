import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { scopeFor } from "../../utils/scope";
import type { CreateTeamInput, UpdateTeamInput } from "./team.schemas";

const teamSelect = {
  id: true,
  name: true,
  createdAt: true,
  leader: { select: { id: true, name: true, phone: true, status: true } },
  members: {
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      placements: {
        where: { endedAt: null },
        orderBy: { startedAt: "asc" },
        select: { id: true, pharmacy: { select: { id: true, name: true } } },
      },
    },
  },
} satisfies Prisma.TeamSelect;

const assertEligibleLeader = async (leaderId: string, exceptTeamId?: string) => {
  const leader = await prisma.user.findUnique({
    where: { id: leaderId },
    select: { role: true, status: true, ledTeam: { select: { id: true, name: true } } },
  });

  if (!leader || leader.role !== UserRole.TEAM_LEADER || leader.status !== UserStatus.ACTIVE) {
    throw new AppError(400, "Leader harus akun Team Leader yang aktif");
  }

  if (leader.ledTeam && leader.ledTeam.id !== exceptTeamId) {
    throw new AppError(409, `Team Leader ini sudah memimpin ${leader.ledTeam.name}`);
  }
};

const assertNameAvailable = async (name: string, exceptTeamId?: string) => {
  const team = await prisma.team.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, id: exceptTeamId ? { not: exceptTeamId } : undefined },
    select: { id: true },
  });

  if (team) {
    throw new AppError(409, "Nama tim sudah dipakai");
  }
};

/** Admin dan Super Admin melihat semua tim; Team Leader hanya timnya sendiri. */
export const listTeams = async (actor: AuditActor) => {
  const scope = await scopeFor(actor);

  if (scope.kind === "team") {
    return scope.teamId ? prisma.team.findMany({ where: { id: scope.teamId }, select: teamSelect }) : [];
  }

  return prisma.team.findMany({ select: teamSelect, orderBy: { name: "asc" } });
};

export const createTeam = async (input: CreateTeamInput, actor: AuditActor, context: AuditContext) => {
  await assertNameAvailable(input.name);
  await assertEligibleLeader(input.leaderId);

  return prisma.$transaction(async (tx) => {
    const team = await tx.team.create({ data: input, select: teamSelect });
    await recordAudit(tx, {
      actor,
      action: "team.create",
      entity: "Team",
      entityId: team.id,
      after: { name: team.name, leaderId: team.leader.id, leaderName: team.leader.name },
      context,
    });
    return team;
  });
};

export const updateTeam = async (teamId: string, input: UpdateTeamInput, actor: AuditActor, context: AuditContext) => {
  const existing = await prisma.team.findUnique({ where: { id: teamId }, select: teamSelect });

  if (!existing) {
    throw new AppError(404, "Tim tidak ditemukan");
  }

  if (input.name) {
    await assertNameAvailable(input.name, teamId);
  }

  if (input.leaderId) {
    await assertEligibleLeader(input.leaderId, teamId);
  }

  return prisma.$transaction(async (tx) => {
    const team = await tx.team.update({ where: { id: teamId }, data: input, select: teamSelect });
    await recordAudit(tx, {
      actor,
      action: "team.update",
      entity: "Team",
      entityId: teamId,
      before: { name: existing.name, leaderId: existing.leader.id, leaderName: existing.leader.name },
      after: { name: team.name, leaderId: team.leader.id, leaderName: team.leader.name },
      context,
    });
    return team;
  });
};
