import { useEffect, useState } from "react";

export type LivePosition = { latitude: number; longitude: number; accuracyM: number; at: number };

export type LiveLocation =
  | { status: "locating"; position: LivePosition | null; message: null }
  | { status: "ready"; position: LivePosition; message: null }
  | { status: "denied" | "unavailable" | "unsupported"; position: LivePosition | null; message: string };

type Failure = { status: "denied" | "unavailable" | "unsupported"; message: string };

/**
 * Memantau GPS selama halaman terbuka dan selalu memakai bacaan terbaru, supaya posisi yang
 * dikirim saat absen adalah posisi sekarang (bukan bacaan lama yang kebetulan lebih akurat).
 */
export function useLiveLocation(enabled = true): LiveLocation {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [failure, setFailure] = useState<Failure | null>(() =>
    typeof navigator !== "undefined" && !navigator.geolocation
      ? { status: "unsupported", message: "Perangkat ini tidak mendukung lokasi." }
      : null,
  );

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (reading) => {
        setFailure(null);
        setPosition({
          latitude: reading.coords.latitude,
          longitude: reading.coords.longitude,
          accuracyM: reading.coords.accuracy,
          at: reading.timestamp,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setFailure({ status: "denied", message: "Izin lokasi ditolak. Izinkan akses lokasi untuk situs ini di pengaturan browser." });
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setFailure({ status: "unavailable", message: "Lokasi belum didapat. Nyalakan GPS dan pastikan tidak dalam mode pesawat." });
        }
        // TIMEOUT: biarkan watchPosition terus mencoba.
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  if (failure) return { ...failure, position };
  return position ? { status: "ready", position, message: null } : { status: "locating", position: null, message: null };
}
