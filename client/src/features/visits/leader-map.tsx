import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { formatDistance, formatTime, getInitials } from "../../lib/format";
import type { LeaderPosition, LeaderTrail } from "../../types/visits";

// Monas, Jakarta: pusat awal sebelum ada titik.
const DEFAULT_CENTER: L.LatLngTuple = [-6.1754, 106.8272];
const TRAIL_COLOR = "#2360e8";

const leaderIcon = (initials: string, active: boolean, selected: boolean) =>
  L.divIcon({
    className: "",
    html: `<span class="grid size-9 place-items-center rounded-full border-[3px] border-white text-[11px] font-bold text-white shadow-[0_2px_8px_rgb(0_0_0/0.35)] ${
      active ? "bg-brand-600" : "bg-gray-500"
    } ${selected ? "ring-4 ring-brand-300" : ""}">${initials}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });

const pharmacyIcon = L.divIcon({
  className: "",
  html: '<span class="block size-3.5 rotate-45 rounded-[3px] border-2 border-white bg-green-600 shadow-[0_1px_4px_rgb(0_0_0/0.4)]"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -8],
});

/** Menyesuaikan tampilan peta saat pilihan berubah, bukan setiap data diperbarui (supaya geseran pengguna tidak hilang). */
function FitBounds({ points, fitKey }: { points: L.LatLngTuple[]; fitKey: string }) {
  const map = useMap();
  const fitted = useRef<string | null>(null);

  useEffect(() => {
    if (points.length === 0 || fitted.current === fitKey) return;
    fitted.current = fitKey;
    if (points.length === 1) {
      map.setView(points[0], 16);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17 });
    }
  }, [map, points, fitKey]);

  return null;
}

/** ABS-03: posisi terakhir semua Team Leader, dan jejak harian leader yang dipilih. */
export default function LeaderMap({
  positions,
  trail,
  selectedId,
  onSelect,
}: {
  positions: LeaderPosition[];
  trail: LeaderTrail | null;
  selectedId: string | null;
  onSelect: (leaderId: string) => void;
}) {
  const located = positions.filter((row) => row.lastPing);
  const trailPoints = useMemo<L.LatLngTuple[]>(() => (trail ? trail.pings.map((ping) => [ping.latitude, ping.longitude]) : []), [trail]);
  const visitPharmacies = useMemo(() => {
    const unique = new Map<string, NonNullable<typeof trail>["visits"][number]["pharmacy"]>();
    trail?.visits.forEach((visit) => unique.set(visit.pharmacy.id, visit.pharmacy));
    return [...unique.values()];
  }, [trail]);

  const fitPoints = useMemo<L.LatLngTuple[]>(() => {
    if (trail && (trailPoints.length > 0 || visitPharmacies.length > 0)) {
      return [...trailPoints, ...visitPharmacies.map((pharmacy): L.LatLngTuple => [pharmacy.latitude, pharmacy.longitude])];
    }
    return located.map((row): L.LatLngTuple => [row.lastPing!.latitude, row.lastPing!.longitude]);
  }, [trail, trailPoints, visitPharmacies, located]);
  const fitKey = `${selectedId ?? "semua"}:${trail?.date ?? ""}:${fitPoints.length > 0}`;

  return (
    <div className="isolate overflow-hidden rounded-2xl border border-line">
      <MapContainer center={DEFAULT_CENTER} zoom={11} scrollWheelZoom className="h-80 w-full sm:h-[420px] xl:h-[560px]">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitBounds points={fitPoints} fitKey={fitKey} />

        {visitPharmacies.map((pharmacy) => (
          <Circle
            key={`radius-${pharmacy.id}`}
            center={[pharmacy.latitude, pharmacy.longitude]}
            radius={pharmacy.radiusM}
            pathOptions={{ color: "#16a34a", weight: 1, fillOpacity: 0.12 }}
          />
        ))}
        {trail?.visits.map((visit) => (
          <Marker key={visit.id} position={[visit.pharmacy.latitude, visit.pharmacy.longitude]} icon={pharmacyIcon}>
            <Popup>
              <strong>{visit.pharmacy.name}</strong>
              <br />
              {formatTime(visit.checkInAt)}–{visit.checkOutAt ? formatTime(visit.checkOutAt) : "belum keluar"} WIB
            </Popup>
          </Marker>
        ))}

        {trailPoints.length > 1 ? <Polyline positions={trailPoints} pathOptions={{ color: TRAIL_COLOR, weight: 4, opacity: 0.75 }} /> : null}
        {trail?.pings.map((ping, index) => (
          <CircleMarker
            key={`${ping.recordedAt}-${index}`}
            center={[ping.latitude, ping.longitude]}
            radius={4}
            pathOptions={{ color: "#fff", weight: 1.5, fillColor: TRAIL_COLOR, fillOpacity: 1 }}
          >
            <Popup>
              {formatTime(ping.recordedAt)} WIB · akurasi ±{formatDistance(ping.accuracyM)}
            </Popup>
          </CircleMarker>
        ))}

        {located.map((row) => (
          <Marker
            key={row.leader.id}
            position={[row.lastPing!.latitude, row.lastPing!.longitude]}
            icon={leaderIcon(getInitials(row.leader.name), row.workDay.status === "ACTIVE", row.leader.id === selectedId)}
            zIndexOffset={row.leader.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(row.leader.id) }}
          >
            <Popup>
              <strong>{row.leader.name}</strong>
              <br />
              Terakhir {formatTime(row.lastPing!.recordedAt)} WIB · ±{formatDistance(row.lastPing!.accuracyM)}
              {row.openVisit ? (
                <>
                  <br />
                  Di {row.openVisit.pharmacy.name} sejak {formatTime(row.openVisit.checkInAt)}
                </>
              ) : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
