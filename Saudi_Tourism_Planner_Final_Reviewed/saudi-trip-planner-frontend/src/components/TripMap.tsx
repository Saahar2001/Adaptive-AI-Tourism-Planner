import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Maximize2, Minimize2, MapPin } from "lucide-react";
import type { Place } from "../lib/types";

// Standard CDN Leaflet markers
const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Selected highlighted marker (custom SVG or styled div icon)
const selectedIcon = new L.DivIcon({
  className: "custom-selected-marker",
  html: `
    <div style="
      width: 36px;
      height: 36px;
      background: #0B6E4F;
      border: 3px solid #FBF7EE;
      box-shadow: 0 0 15px rgba(11, 110, 79, 0.7);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        width: 12px;
        height: 12px;
        background: #FBF7EE;
        border-radius: 50%;
        transform: rotate(45deg);
      "></div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

const CITY_CENTERS: Record<string, [number, number]> = {
  Riyadh: [24.7136, 46.6753],
  Jeddah: [21.4858, 39.1925],
  Makkah: [21.3891, 39.8579],
  Madinah: [24.5247, 39.5692],
  AlUla: [26.6084, 37.9214],
  Abha: [18.2164, 42.5053],
  Dammam: [26.4207, 50.0888],
  Tabuk: [28.3838, 36.5550],
};

interface MapControllerProps {
  places: Place[];
  selectedPlace?: string | null;
  city: string;
}

function MapController({ places, selectedPlace, city }: MapControllerProps) {
  const map = useMap();
  const prevSelectedRef = useRef<string | null>(null);

  // Auto fit bounds when places list changes
  useEffect(() => {
    const valid = places.filter(
      (p) => typeof p.latitude === "number" && typeof p.longitude === "number"
    );
    if (valid.length > 1) {
      const bounds = L.latLngBounds(
        valid.map((p) => [p.latitude!, p.longitude!] as [number, number])
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: true });
    } else if (valid.length === 1) {
      map.setView([valid[0].latitude!, valid[0].longitude!], 13, { animate: true });
    } else {
      const fallback = CITY_CENTERS[city] ?? [24.7136, 46.6753];
      map.setView(fallback, 11, { animate: true });
    }
  }, [places, city, map]);

  // Fly to selected place when user clicks card
  useEffect(() => {
    if (selectedPlace && selectedPlace !== prevSelectedRef.current) {
      prevSelectedRef.current = selectedPlace;
      const target = places.find((p) => p.name === selectedPlace);
      if (
        target &&
        typeof target.latitude === "number" &&
        typeof target.longitude === "number"
      ) {
        map.flyTo([target.latitude, target.longitude], 15, {
          animate: true,
          duration: 1.0,
        });
      }
    }
  }, [selectedPlace, places, map]);

  return null;
}

interface TripMapProps {
  city: string;
  places: Place[];
  selectedPlace?: string | null;
  onSelectPlace?: (placeName: string) => void;
  className?: string;
}

export default function TripMap({
  city,
  places,
  selectedPlace,
  onSelectPlace,
  className = "w-full h-full min-h-[380px] rounded-2xl",
}: TripMapProps) {
  const center = CITY_CENTERS[city] ?? [24.7136, 46.6753];
  const [isFullscreen, setIsFullscreen] = useState(false);
  const markerRefs = useRef<Record<string, L.Marker>>({});

  // Filter only valid coordinates
  const located = places.filter(
    (p) =>
      typeof p.latitude === "number" &&
      typeof p.longitude === "number" &&
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude)
  );

  // Automatically open popup of selected place
  useEffect(() => {
    if (selectedPlace && markerRefs.current[selectedPlace]) {
      markerRefs.current[selectedPlace].openPopup();
    }
  }, [selectedPlace]);

  const mapContent = (
    <div className={`relative ${isFullscreen ? "w-full h-full" : "w-full h-full"}`}>
      <MapContainer
        center={center}
        zoom={12}
        zoomControl={true}
        scrollWheelZoom={true}
        className="w-full h-full rounded-2xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController places={located} selectedPlace={selectedPlace} city={city} />

        {located.map((p, i) => {
          const isSelected = selectedPlace === p.name;
          return (
            <Marker
              key={`${p.name}-${i}`}
              position={[p.latitude!, p.longitude!]}
              icon={isSelected ? selectedIcon : defaultIcon}
              ref={(ref) => {
                if (ref) markerRefs.current[p.name] = ref;
              }}
              eventHandlers={{
                click: () => {
                  if (onSelectPlace) onSelectPlace(p.name);
                },
              }}
            >
              <Popup className="font-body">
                <div className="p-1 max-w-[200px]">
                  <p className="font-bold text-ink-900 text-sm">{p.name}</p>
                  {p.category && (
                    <p className="text-xs text-palm-700 capitalize mt-0.5">{p.category}</p>
                  )}
                  {p.address && (
                    <p className="text-[11px] text-ink-700/70 mt-1 line-clamp-2">{p.address}</p>
                  )}
                  {typeof p.estimated_cost === "number" && (
                    <p className="text-xs font-semibold text-palm-700 mt-1">
                      Est. {p.estimated_cost} SAR
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Expand / Fullscreen Map Toggle Button */}
      <button
        onClick={() => setIsFullscreen((prev) => !prev)}
        className="absolute top-3 right-3 z-[400] bg-white/90 hover:bg-white text-ink-900 p-2 rounded-xl shadow-md border border-ink-900/10 transition flex items-center gap-1.5 text-xs font-body font-medium"
        title={isFullscreen ? "Close fullscreen map" : "Expand map"}
        aria-label="Toggle fullscreen map"
      >
        {isFullscreen ? (
          <>
            <Minimize2 className="w-4 h-4 text-palm-700" />
            <span>Close Map</span>
          </>
        ) : (
          <>
            <Maximize2 className="w-4 h-4 text-palm-700" />
            <span>Expand</span>
          </>
        )}
      </button>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 sm:p-8 flex flex-col">
        <div className="flex-1 bg-white rounded-3xl overflow-hidden shadow-2xl relative">
          {mapContent}
        </div>
      </div>
    );
  }

  return <div className={className}>{mapContent}</div>;
}
