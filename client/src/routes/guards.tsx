import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingScreen } from "../components/ui";
import { useAuth } from "../features/auth/auth-context";
import type { UserRole } from "../types/auth";
import { isPathAvailableForRole } from "./navigation";
import { NotFoundPage } from "./not-found-page";

const CHANGE_PASSWORD_PATH = "/ganti-sandi";

/** Hanya untuk pengguna yang sudah masuk; yang wajib ganti sandi diarahkan ke halaman ganti sandi. */
export function RequireAuth() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <LoadingScreen label="Memeriksa sesi..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  if (!user.mustChangePassword && location.pathname === CHANGE_PASSWORD_PATH) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

/** Halaman login tidak perlu ditampilkan lagi bila sesi masih aktif. */
export function RedirectIfAuthenticated() {
  const { status, user } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  if (status === "loading") {
    return <LoadingScreen label="Memeriksa sesi..." />;
  }

  if (user) {
    // Halaman terakhir bisa milik pengguna lain di HP yang sama (mis. akun kasir bersama).
    return <Navigate to={from && isPathAvailableForRole(user.role, from) ? from : "/"} replace />;
  }

  return <Outlet />;
}

/** Halaman khusus peran tertentu; peran lain melihat halaman "tidak ditemukan". Server tetap memeriksa akses. */
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { user } = useAuth();

  return user && roles.includes(user.role) ? <Outlet /> : <NotFoundPage />;
}
