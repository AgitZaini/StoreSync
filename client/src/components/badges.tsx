import { roleLabels } from "../lib/roles";
import type { UserRole, UserStatus } from "../types/auth";
import type { PharmacyStatus } from "../types/master-data";
import { Pill } from "./ui";
import type { PillTone } from "./ui";

const roleTones: Record<UserRole, PillTone> = {
  SUPER_ADMIN: "dark",
  ADMIN: "blue",
  TEAM_LEADER: "violet",
  SPG: "green",
  KASIR: "orange",
};

export function RolePill({ role }: { role: UserRole }) {
  return <Pill tone={roleTones[role]}>{roleLabels[role]}</Pill>;
}

export function UserStatusPill({ status }: { status: UserStatus }) {
  return status === "ACTIVE" ? <Pill tone="green">Aktif</Pill> : <Pill tone="gray">Nonaktif</Pill>;
}

const pharmacyStatus: Record<PharmacyStatus, { label: string; tone: PillTone }> = {
  ACTIVE: { label: "Aktif", tone: "green" },
  INACTIVE: { label: "Nonaktif", tone: "gray" },
  PROSPECT: { label: "Calon mitra", tone: "orange" },
};

export function PharmacyStatusPill({ status }: { status: PharmacyStatus }) {
  return <Pill tone={pharmacyStatus[status].tone}>{pharmacyStatus[status].label}</Pill>;
}
