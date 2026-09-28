import type { PharmacyBase } from "./master-data";

export type AttendanceKind = "CHECK_IN" | "CHECK_OUT";

export type AttendanceStatus = "OFF" | "UPCOMING" | "NOT_CHECKED_IN" | "ON_TIME" | "LATE" | "ABSENT" | "UNSCHEDULED";

export type ScheduleValue = { isOff: boolean; startTime: string | null; endTime: string | null };

export type FaceCheck = {
  passed: boolean;
  method: string;
  faces?: number;
  blinkDetected?: boolean;
  durationMs?: number;
  failureReason?: string;
};

export type AttendanceRecord = {
  id: string;
  kind: AttendanceKind;
  serverAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  distanceM: number;
  photoFileId: string;
  exceptionId: string | null;
};

export type TodayPharmacy = {
  pharmacy: PharmacyBase;
  schedule: ScheduleValue | null;
  checkIn: AttendanceRecord | null;
  checkOut: AttendanceRecord | null;
  pendingExceptions: Array<{ id: string; kind: AttendanceKind; requestedAt: string; reason: string }>;
  status: AttendanceStatus | null;
  lateMinutes: number;
  nextAction: AttendanceKind | null;
};

export type TodayResponse = {
  date: string;
  serverTime: string;
  maxAccuracyM: number;
  openPharmacyId: string | null;
  pharmacies: TodayPharmacy[];
};

export type AttendanceHistoryItem = AttendanceRecord & {
  businessDate: string;
  user: { id: string; name: string };
  pharmacy: { id: string; name: string };
};

export type MonitorAttendance = {
  id: string;
  serverAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  distanceM: number;
  photoFileId: string;
  viaException: boolean;
};

export type MonitorRow = {
  spg: { id: string; name: string; team: { id: string; name: string } | null };
  pharmacy: { id: string; name: string };
  schedule: ScheduleValue | null;
  status: AttendanceStatus;
  lateMinutes: number;
  checkIn: MonitorAttendance | null;
  checkOut: MonitorAttendance | null;
  note: string | null;
  pendingExceptions: number;
};

export type MonitorSummary = {
  scheduled: number;
  onTime: number;
  late: number;
  notCheckedIn: number;
  absent: number;
  upcoming: number;
  off: number;
  unscheduled: number;
  pendingExceptions: number;
};

export type MonitorResponse = {
  date: string;
  generatedAt: string;
  lateToleranceMinutes: number;
  summary: MonitorSummary;
  rows: MonitorRow[];
};

export type AttendanceException = {
  id: string;
  kind: AttendanceKind;
  businessDate: string;
  requestedAt: string;
  photoFileId: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  distanceM: number;
  faceCheck: FaceCheck | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedAt: string | null;
  reviewNote: string | null;
  user: { id: string; name: string; phone: string };
  pharmacy: { id: string; name: string; radiusM: number };
};

export type ScheduleRow = {
  spg: { id: string; name: string; status: "ACTIVE" | "INACTIVE"; team: { id: string; name: string } | null };
  pharmacy: { id: string; name: string; is24h: boolean; openTime: string | null; closeTime: string | null };
  availableDates: string[];
  entries: Record<string, ScheduleValue & { updatedAt: string }>;
};

export type ScheduleWeek = { weekStart: string; dates: string[]; rows: ScheduleRow[] };
