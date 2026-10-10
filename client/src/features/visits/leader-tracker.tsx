import { useQueryClient } from "@tanstack/react-query";
import { MapPinOff, Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveLocation } from "../../hooks/use-live-location";
import type { LivePosition } from "../../hooks/use-live-location";
import { getErrorCode, getErrorMessage } from "../../lib/api";
import { formatTime } from "../../lib/format";
import { sendLocationPing, useVisitToday, VISIT_TODAY_KEY } from "./visits-api";

/** ABS-03: lokasi dikirim berkala (tiap 5 menit) selama sesi kerja. */
const PING_INTERVAL_MS = 5 * 60 * 1000;
const CHECK_EVERY_MS = 20 * 1000;
/** Bila ping gagal karena jaringan, coba lagi lebih cepat dari jadwal normal. */
const RETRY_AFTER_MS = 60 * 1000;

/** Menjaga layar tetap menyala selama `active`; dilepas otomatis oleh browser saat tab disembunyikan. */
function useScreenWakeLock(active: boolean) {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const request = async () => {
      if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;

      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (disposed) {
          void sentinel.release();
          return;
        }
        setHeld(true);
        sentinel.addEventListener("release", () => setHeld(false));
      } catch {
        // Ditolak browser (mis. mode hemat baterai); pelacakan tetap berjalan selama layar menyala.
        setHeld(false);
      }
    };

    void request();
    document.addEventListener("visibilitychange", request);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", request);
      void sentinel?.release();
    };
  }, [active]);

  return active && held;
}

/**
 * Pelacak lokasi live Team Leader di latar depan (batasan web yang disepakati): selama sesi kerja
 * aktif dan aplikasi terbuka, posisi terbaru dari `watchPosition` dikirim tiap 5 menit. Tampil
 * sebagai banner "biarkan aplikasi terbuka" di semua halaman TL.
 */
export function LeaderTracker() {
  const queryClient = useQueryClient();
  const today = useVisitToday();
  const workDay = today.data?.workDay;
  const active = workDay?.status === "ACTIVE";
  const location = useLiveLocation(active);
  const wakeLockHeld = useScreenWakeLock(active);
  const positionRef = useRef<LivePosition | null>(null);
  const lastAttemptRef = useRef(0);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);
  const hasPosition = location.position !== null;

  useEffect(() => {
    positionRef.current = location.position;
  }, [location.position]);

  // Batas jam kerja: minta status baru ke server saat jamnya tiba supaya pelacakan berhenti.
  useEffect(() => {
    if (!workDay || workDay.status !== "ACTIVE") return;
    const timer = window.setTimeout(
      () => void queryClient.invalidateQueries({ queryKey: VISIT_TODAY_KEY }),
      Math.max(new Date(workDay.endsAt).getTime() - Date.now(), 0) + 1000,
    );
    return () => window.clearTimeout(timer);
  }, [workDay, queryClient]);

  useEffect(() => {
    if (!active || !hasPosition) return;

    const tick = async () => {
      const position = positionRef.current;
      // Tab tersembunyi: GPS dibekukan browser, jadi jangan kirim posisi lama sebagai posisi sekarang.
      if (!position || document.visibilityState !== "visible") return;
      if (Date.now() - lastAttemptRef.current < PING_INTERVAL_MS) return;

      lastAttemptRef.current = Date.now();
      try {
        const result = await sendLocationPing({ latitude: position.latitude, longitude: position.longitude, accuracyM: position.accuracyM });
        setLastSentAt(result.recordedAt);
        setPingError(null);
      } catch (error) {
        if (getErrorCode(error) === "OUTSIDE_WORK_SESSION") {
          void queryClient.invalidateQueries({ queryKey: VISIT_TODAY_KEY });
        } else {
          setPingError(getErrorMessage(error, "Lokasi gagal terkirim."));
          lastAttemptRef.current = Date.now() - PING_INTERVAL_MS + RETRY_AFTER_MS;
        }
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), CHECK_EVERY_MS);
    const onVisible = () => void tick();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, hasPosition, queryClient]);

  if (!active || !workDay) return null;

  if (location.status === "denied" || location.status === "unavailable" || location.status === "unsupported") {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
        <MapPinOff className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="font-semibold">Lokasi live tidak terkirim.</strong> {location.message}
        </span>
      </div>
    );
  }

  const sentAt = lastSentAt ?? today.data?.lastPing?.recordedAt ?? null;

  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
      <span className="relative mt-1 flex size-2.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-75" />
        <span className="relative inline-flex size-2.5 rounded-full bg-brand-600" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-semibold">Lokasi live aktif</span>
        {sentAt ? ` · terakhir terkirim ${formatTime(sentAt)} WIB` : " · menunggu lokasi pertama"}
        <span className="block text-xs text-brand-700">
          Biarkan aplikasi tetap terbuka selama jam kerja (sampai {formatTime(workDay.endsAt)} atau{" "}
          <Link to="/absen-kunjungan" className="font-semibold underline">
            Selesai hari ini
          </Link>
          ).{wakeLockHeld ? " Layar dijaga tetap menyala." : ""}
        </span>
        {pingError ? <span className="mt-1 block text-xs font-medium text-red-600">{pingError} Dicoba lagi otomatis.</span> : null}
      </span>
      <Radio className="mt-0.5 size-4 shrink-0 text-brand-500" />
    </div>
  );
}
