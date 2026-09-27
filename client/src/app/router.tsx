import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { ChangePasswordPage } from "../features/auth/change-password-page";
import { LoginPage } from "../features/auth/login-page";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { NotificationsPage } from "../features/notifications/notifications-page";
import { ProfilePage } from "../features/profile/profile-page";
import { RedirectIfAuthenticated, RequireAuth } from "../routes/guards";
import { NotFoundPage } from "../routes/not-found-page";

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
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
