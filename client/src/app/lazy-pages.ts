import { lazy } from "react";

// Halaman khusus Super Admin dimuat terpisah supaya HP SPG/kasir tidak ikut mengunduhnya.
export const UsersPage = lazy(() => import("../features/users/users-page").then((module) => ({ default: module.UsersPage })));
export const UserDetailPage = lazy(() =>
  import("../features/users/user-detail-page").then((module) => ({ default: module.UserDetailPage })),
);
export const PharmaciesPage = lazy(() =>
  import("../features/pharmacies/pharmacies-page").then((module) => ({ default: module.PharmaciesPage })),
);
export const PharmacyFormPage = lazy(() =>
  import("../features/pharmacies/pharmacy-form-page").then((module) => ({ default: module.PharmacyFormPage })),
);
export const ProductsPage = lazy(() => import("../features/products/products-page").then((module) => ({ default: module.ProductsPage })));
export const SettingsPage = lazy(() => import("../features/settings/settings-page").then((module) => ({ default: module.SettingsPage })));
export const AuditLogPage = lazy(() => import("../features/audit-log/audit-log-page").then((module) => ({ default: module.AuditLogPage })));

// Tahap 3: absen (kamera + model wajah), jadwal, pemantauan, tim.
export const AttendancePage = lazy(() =>
  import("../features/attendance/attendance-page").then((module) => ({ default: module.AttendancePage })),
);
export const AttendanceMonitorPage = lazy(() =>
  import("../features/attendance/attendance-monitor-page").then((module) => ({ default: module.AttendanceMonitorPage })),
);
export const MySchedulePage = lazy(() =>
  import("../features/schedules/my-schedule-page").then((module) => ({ default: module.MySchedulePage })),
);
export const ScheduleWeekPage = lazy(() =>
  import("../features/schedules/schedule-week-page").then((module) => ({ default: module.ScheduleWeekPage })),
);
export const TeamPage = lazy(() => import("../features/team/team-page").then((module) => ({ default: module.TeamPage })));
