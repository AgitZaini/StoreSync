import type { Prisma } from "@prisma/client";

export const publicUserSelect = {
  id: true,
  name: true,
  phone: true,
  role: true,
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const userSummarySelect = {
  ...publicUserSelect,
  team: { select: { id: true, name: true } },
  ledTeam: { select: { id: true, name: true } },
  kasirPharmacy: { select: { id: true, name: true } },
  placements: {
    where: { endedAt: null },
    orderBy: { startedAt: "asc" },
    select: { id: true, startedAt: true, pharmacy: { select: { id: true, name: true } } },
  },
} satisfies Prisma.UserSelect;

export const userDetailSelect = {
  ...publicUserSelect,
  team: { select: { id: true, name: true, leader: { select: { id: true, name: true } } } },
  ledTeam: {
    select: {
      id: true,
      name: true,
      members: { orderBy: { name: "asc" }, select: { id: true, name: true, phone: true, status: true } },
    },
  },
  kasirPharmacy: { select: { id: true, name: true, status: true } },
  placements: {
    orderBy: [{ endedAt: { sort: "desc", nulls: "first" } }, { startedAt: "desc" }],
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      endReason: true,
      pharmacy: { select: { id: true, name: true, address: true, status: true } },
    },
  },
} satisfies Prisma.UserSelect;
