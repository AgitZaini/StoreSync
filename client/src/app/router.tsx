import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { ChangePasswordPage } from "../features/auth/change-password-page";
import { LoginPage } from "../features/auth/login-page";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { NotificationsPage } from "../features/notifications/notifications-page";
import { ProfilePage } from "../features/profile/profile-page";
import { RedirectIfAuthenticated, RequireAuth, RequireRole } from "../routes/guards";
import { NotFoundPage } from "../routes/not-found-page";
import {
  AttendanceMonitorPage,
  AttendancePage,
  AuditLogPage,
  LeaderMapPage,
  MySchedulePage,
  PharmaciesPage,
  PharmacyFormPage,
  ProductsPage,
  ScheduleWeekPage,
  SettingsPage,
  TeamPage,
  UserDetailPage,
  UsersPage,
  VisitAttendancePage,
  VisitEvaluationPage,
  VisitPlanPage,
} from "./lazy-pages";

export const router = createBrowserRouter([
  {
    element: <RedirectIfAuthenticated />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: "/ganti-sandi", element: <ChangePasswordPage /> },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "/notifikasi", element: <NotificationsPage /> },
          { path: "/profil", element: <ProfilePage /> },
          {
            element: <RequireRole roles={["SUPER_ADMIN"]} />,
            children: [
              { path: "/pengguna", element: <UsersPage /> },
              { path: "/pengguna/:id", element: <UserDetailPage /> },
              { path: "/apotek", element: <PharmaciesPage /> },
              { path: "/apotek/baru", element: <PharmacyFormPage /> },
              { path: "/apotek/:id", element: <PharmacyFormPage /> },
              { path: "/produk", element: <ProductsPage /> },
              { path: "/pengaturan", element: <SettingsPage /> },
              { path: "/riwayat", element: <AuditLogPage /> },
            ],
          },
          {
            element: <RequireRole roles={["SPG"]} />,
            children: [
              { path: "/absen", element: <AttendancePage /> },
              { path: "/jadwal-saya", element: <MySchedulePage /> },
            ],
          },
          {
            element: <RequireRole roles={["ADMIN"]} />,
            children: [{ path: "/jadwal", element: <ScheduleWeekPage /> }],
          },
          {
            element: <RequireRole roles={["ADMIN", "SUPER_ADMIN"]} />,
            children: [
              { path: "/pemantauan-absen", element: <AttendanceMonitorPage /> },
              { path: "/peta-leader", element: <LeaderMapPage /> },
              { path: "/evaluasi-kunjungan", element: <VisitEvaluationPage /> },
            ],
          },
          {
            element: <RequireRole roles={["TEAM_LEADER"]} />,
            children: [
              { path: "/tim", element: <TeamPage /> },
              { path: "/absen-kunjungan", element: <VisitAttendancePage /> },
              { path: "/rencana-kunjungan", element: <VisitPlanPage /> },
            ],
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
