import type { UserRole } from "../types/auth";

export const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  TEAM_LEADER: "Team Leader",
  SPG: "SPG",
  KASIR: "Kasir Apotek",
};
