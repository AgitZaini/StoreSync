import { createContext, useContext } from "react";
import type { AuthResponse, AuthUser } from "../../types/auth";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  /** Alasan sesi terakhir berakhir (mis. tidak aktif), ditampilkan di halaman login. */
  sessionMessage: string | null;
  login: (phone: string, password: string) => Promise<AuthUser>;
  logout: (message?: string) => Promise<void>;
  /** Menyimpan token dan pengguna dari respons login/ganti sandi. */
  applySession: (session: AuthResponse) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth harus dipakai di dalam AuthProvider");
  }

  return context;
}

/** Untuk halaman di dalam RequireAuth, tempat pengguna dijamin sudah masuk. */
export function useCurrentUser() {
  const { user } = useAuth();

  if (!user) {
    throw new Error("useCurrentUser dipakai di luar RequireAuth");
  }

  return user;
}
