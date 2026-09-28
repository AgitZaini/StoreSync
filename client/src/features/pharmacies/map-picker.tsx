import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

export type Coordinates = { latitude: number; longitude: number };

// Monas, Jakarta: titik awal sebelum lokasi apotek dipilih.
const DEFAULT_CENTER: L.LatLngTuple = [-6.1754, 106.8272];
const PICKED_ZOOM = 18;

const pinIcon = L.divIcon({
  className: "",
  html: '<span class="block size-5 rounded-full border-[3px] border-white bg-brand-600 shadow-[0_2px_8px_rgb(0_0_0/0.35)]"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function ClickToPick({ onPick }: { onPick: (coordinates: Coordinates) => void }) {
  useMapEvents({
    click: (event) => onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng }),
  });
  return null;
}

/** Memusatkan peta bila titik diubah dari luar peta (ketik koordinat, lokasi saya). */
function FollowValue({ value }: { value: Coordinates | null }) {
  const map = useMap();
  const latitude = value?.latitude;
  const longitude = value?.longitude;

  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined) {
      const target = L.latLng(latitude, longitude);

      if (!map.getBounds().pad(-0.2).contains(target)) {
        map.setView(target, Math.max(map.getZoom(), PICKED_ZOOM - 1));
      }
    }
  }, [latitude, longitude, map]);

  return null;
}

/** Peta untuk memilih titik apotek dan melihat lingkaran radius absen (AKN-03, AB-02). */
export default function MapPicker({
  value,
  radiusM,
  onChange,
}: {
  value: Coordinates | null;
  radiusM: number;
  onChange: (coordinates: Coordinates) => void;
}) {
  // Pusat awal hanya dipakai saat peta dibuat; perpindahan berikutnya lewat FollowValue.
  const [initialCenter] = useState<L.LatLngTuple>(() => (value ? [value.latitude, value.longitude] : DEFAULT_CENTER));

  return (
    <div className="isolate overflow-hidden rounded-2xl border border-line">
      <MapContainer
        center={initialCenter}
        zoom={value ? PICKED_ZOOM : 12}
        scrollWheelZoom={false}
        className="h-72 w-full sm:h-96"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ClickToPick onPick={onChange} />
        <FollowValue value={value} />
        {value ? (
          <>
            <Circle
              center={[value.latitude, value.longitude]}
              radius={radiusM}
              pathOptions={{ color: "#2360e8", weight: 2, fillOpacity: 0.12 }}
            />
            <Marker
              position={[value.latitude, value.longitude]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const position = (event.target as L.Marker).getLatLng();
                  onChange({ latitude: position.lat, longitude: position.lng });
                },
              }}
            />
          </>
        ) : null}
      </MapContainer>
    </div>
  );
}
