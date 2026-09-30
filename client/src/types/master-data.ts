import type { MonitorSummary } from "./attendance";
import type { UserRole, UserStatus } from "./auth";

export type PharmacyStatus = "PROSPECT" | "ACTIVE" | "INACTIVE";

type Ref = { id: string; name: string };

export type ActivePlacementRef = { id: string; startedAt: string; pharmacy: Ref };

export type UserSummary = {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  team: Ref | null;
  ledTeam: Ref | null;
  kasirPharmacy: Ref | null;
  placements: ActivePlacementRef[];
};

export type PlacementHistoryItem = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
  pharmacy: Ref & { address: string; status: PharmacyStatus };
};

export type UserDetail = Omit<UserSummary, "team" | "ledTeam" | "kasirPharmacy" | "placements"> & {
  team: (Ref & { leader: Ref }) | null;
  ledTeam: (Ref & { members: Array<Ref & { phone: string; status: UserStatus }> }) | null;
  kasirPharmacy: (Ref & { status: PharmacyStatus }) | null;
  placements: PlacementHistoryItem[];
};

export type Team = Ref & {
  createdAt: string;
  leader: Ref & { phone: string; status: UserStatus };
  members: Array<
    Ref & { phone: string; status: UserStatus; placements: Array<{ id: string; pharmacy: Ref }> }
  >;
};

export type PharmacyBase = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  is24h: boolean;
  openTime: string | null;
  closeTime: string | null;
  status: PharmacyStatus;
  createdAt: string;
  updatedAt: string;
};

/** Tampilan Admin/Super Admin: lengkap dengan akun kasir dan SPG yang ditempatkan. */
export type Pharmacy = PharmacyBase & {
  kasir: {
    id: string;
    name: string;
    phone: string;
    status: UserStatus;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
  } | null;
  placements: Array<{ id: string; startedAt: string; spg: Ref & { phone: string } }>;
};

export type Placement = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
  spg: Ref & { phone: string; team: (Ref & { leaderId: string }) | null };
  pharmacy: Ref & { address: string };
};

export type Product = {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TargetRow = {
  spg: Ref & { status: UserStatus; team: Ref | null };
  amount: string | null;
  updatedAt: string | null;
};

export type TargetsResponse = { month: string; targets: TargetRow[]; totalAmount: string };

export type DeductionRate = {
  id: string;
  amountPerDay: string;
  effectiveFrom: string;
  createdByName: string | null;
};

export type Settings = {
  leaveQuotaDays: number;
  attendance: { maxAccuracyM: number; lateToleranceMinutes: number; leaderWorkEndTime: string };
  deductionRate: DeductionRate | null;
  deductionRates: DeductionRate[];
};

export type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  evidenceFileIds: string[];
  ip: string | null;
  createdAt: string;
  actor: { id: string; name: string; role: UserRole } | null;
};

export type AuditLogPage = { entries: AuditEntry[]; nextCursor: string | null };

export type Overview = {
  attendanceToday: MonitorSummary;
  leadersToday: { leaders: number; active: number; started: number; visits: number; openVisits: number };
  orders: { submitted: number; approved: number; shipped: number; openDiscrepancies: number };
  warehouse: { products: number; totalQty: number; outOfStock: Ref[] };
  activeUsers: Record<UserRole, number>;
  pharmacies: Record<PharmacyStatus, number>;
  activeProducts: number;
  spgWithoutPlacement: Ref[];
  spgWithoutTeam: Ref[];
  targets: { month: string; activeSpg: number; spgWithTarget: number; totalAmount: string | number };
};
