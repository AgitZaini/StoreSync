import type { PharmacyBase, PharmacyStatus } from "./master-data";

type Ref = { id: string; name: string };

export type WorkDayStatus = "NOT_STARTED" | "ACTIVE" | "ENDED";

/** Sesi kerja harian Team Leader (ABS-03). */
export type WorkDay = {
  status: WorkDayStatus;
  startedAt: string | null;
  endedAt: string | null;
  /** Batas jam kerja hari itu; lokasi live berhenti diterima setelah jam ini. */
  endsAt: string;
};

export type VisitAttendance = {
  id: string;
  serverAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  distanceM: number;
  photoFileId: string;
};

/** Kunjungan Team Leader di satu apotek (ABS-02). */
export type LeaderVisit = {
  id: string;
  businessDate: string;
  checkInAt: string;
  checkOutAt: string | null;
  durationMin: number | null;
  pharmacy: Ref & { address: string; latitude: number; longitude: number; radiusM: number };
  checkIn: VisitAttendance;
  checkOut: VisitAttendance | null;
};

export type VisitTodayResponse = {
  date: string;
  serverTime: string;
  maxAccuracyM: number;
  workDay: WorkDay;
  openVisit: LeaderVisit | null;
  visits: LeaderVisit[];
  totalMinutes: number;
  plan: Array<{ id: string; addedAfterLock: boolean; pharmacy: PharmacyBase; visited: boolean }>;
  lastPing: { recordedAt: string; accuracyM: number } | null;
  /** Apotek rencana yang terlewat tanpa alasan (4 minggu terakhir) dan minggu tertuanya. */
  missingReasons: { count: number; weekStart: string | null };
};

export type PingResponse = { stored: boolean; recordedAt: string; workDay: WorkDay };

export type LeaderRef = Ref & { phone: string; status: "ACTIVE" | "INACTIVE"; team: Ref | null };

export type LocationPoint = { latitude: number; longitude: number; accuracyM: number; recordedAt: string };

export type LeaderPosition = {
  leader: LeaderRef;
  workDay: WorkDay;
  lastPing: LocationPoint | null;
  pingCount: number;
  visitCount: number;
  totalMinutes: number;
  openVisit: { pharmacy: Ref; checkInAt: string } | null;
};

export type LeaderPositionsResponse = {
  date: string;
  generatedAt: string;
  workEndTime: string;
  summary: { leaders: number; active: number; started: number; visits: number; openVisits: number };
  leaders: LeaderPosition[];
};

export type LeaderTrail = {
  date: string;
  leader: LeaderRef;
  workDay: WorkDay;
  pings: LocationPoint[];
  visits: LeaderVisit[];
};

export type PlanItemStatus = "VISITED" | "MISSED" | "PENDING" | "REMOVED";

export type PlanItem = {
  id: string;
  date: string;
  addedAfterLock: boolean;
  removedAt: string | null;
  missReason: string | null;
  missReasonAt: string | null;
  createdAt: string;
  pharmacy: Ref & { address: string; status: PharmacyStatus };
  evidence: { id: string; mimeType: string } | null;
  status: PlanItemStatus;
  visits: Array<{ id: string; checkInAt: string; checkOutAt: string | null; durationMin: number | null }>;
  totalMinutes: number;
};

export type PlanSummary = {
  planned: number;
  visited: number;
  missed: number;
  missingReason: number;
  unplanned: number;
  visits: number;
  totalMinutes: number;
};

export type PlanDay = {
  date: string;
  timing: "PAST" | "TODAY" | "FUTURE";
  items: PlanItem[];
  unplannedVisits: Array<{
    id: string;
    checkInAt: string;
    checkOutAt: string | null;
    durationMin: number | null;
    pharmacy: Ref & { address: string };
  }>;
  summary: PlanSummary;
};

/** KNJ-01/KNJ-02: rencana satu minggu beserta evaluasinya. */
export type VisitPlanWeek = {
  leader: Ref & { status: "ACTIVE" | "INACTIVE"; team: Ref | null };
  weekStart: string;
  dates: string[];
  today: string;
  lockedAt: string;
  isLocked: boolean;
  editable: boolean;
  hasPlan: boolean;
  updatedAt: string | null;
  days: PlanDay[];
  summary: PlanSummary;
};

export type VisitPlanSummaryResponse = {
  weekStart: string;
  dates: string[];
  leaders: Array<{
    leader: Ref & { status: "ACTIVE" | "INACTIVE"; team: Ref | null };
    hasPlan: boolean;
    isLocked: boolean;
    summary: PlanSummary;
  }>;
};
