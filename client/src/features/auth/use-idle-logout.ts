import { useEffect } from "react";
import { authStorage } from "../../lib/auth-storage";
import { useAuth } from "./auth-context";

const IDLE_TIMEOUT_MS = (Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES) || 30) * 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
const WRITE_THROTTLE_MS = 15 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

/** Mengeluarkan pengguna setelah tidak ada aktivitas di semua tab selama batas idle. */
export function useIdleLogout() {
  const { status, logout } = useAuth();

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let lastWrite = 0;

    const markActive = () => {
      const now = Date.now();

      if (now - lastWrite > WRITE_THROTTLE_MS) {
        lastWrite = now;
        authStorage.setLastActivityAt(now);
      }
    };

    const checkIdle = () => {
      const lastActivity = authStorage.getLastActivityAt() ?? Date.now();

      if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
        void logout("Sesi berakhir karena tidak ada aktivitas. Silakan masuk lagi.");
      }
    };

    // Saat HP dibuka lagi, cek dulu sebelum menandai aktif.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkIdle();
      }
    };

    checkIdle();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActive, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(checkIdle, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive));
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, [logout, status]);
}
