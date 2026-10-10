import { LocateFixed } from "lucide-react";
import type { LiveLocation } from "../hooks/use-live-location";
import { cn } from "../lib/utils";
import { Notice, Spinner } from "./ui";

/** Status GPS di halaman absen: akurasi sekarang dibanding batas dari Pengaturan. */
export function LocationBanner({ location, maxAccuracyM }: { location: LiveLocation; maxAccuracyM: number }) {
  if (location.status === "ready" || (location.position && location.status !== "denied")) {
    const accuracy = Math.round(location.position!.accuracyM);
    const good = accuracy <= maxAccuracyM;

    return (
      <div className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm", good ? "bg-green-50 text-green-800" : "bg-orange-50 text-orange-800")}>
        <LocateFixed className="size-5 shrink-0" />
        <span>
          Lokasi terkunci, akurasi <strong>±{accuracy} m</strong>
          {good ? "" : `. Tunggu sampai di bawah ±${maxAccuracyM} m (dekat pintu/jendela).`}
        </span>
      </div>
    );
  }

  if (location.status === "locating") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-canvas px-4 py-3 text-sm text-muted">
        <Spinner className="size-4" />
        Mencari lokasi GPS...
      </div>
    );
  }

  return <Notice tone="red">{location.message}</Notice>;
}
