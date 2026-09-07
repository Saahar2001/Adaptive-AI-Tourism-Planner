import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Maximize2, Minimize2, Heart } from "lucide-react";
import type { Place, FavoritePlace } from "../lib/types";

// Standard CDN Leaflet markers
const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Selected highlighted marker (emerald styled pin)
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

// Subtle favorite marker (rose/red pin with heart)
const favoriteIcon = new L.DivIcon({
  className: "custom-favorite-marker",
  html: `
    <div style="
      width: 32px;
      height: 32px;
      background: #E11D48;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 2px 10px rgba(225, 29, 72, 0.45);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="
        font-size: 14px;
        transform: rotate(45deg);
        line-height: 1;
      ">❤️</span>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Selected favorite marker (larger glowing rose pin with heart)
const selectedFavoriteIcon = new L.DivIcon({
  className: "custom-selected-fav-marker",
  html: `
    <div style="
      width: 40px;
      height: 40px;
      background: #BE123C;
      border: 3px solid #FFFFFF;
      box-shadow: 0 0 18px rgba(225, 29, 72, 0.75);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="
        font-size: 16px;
        transform: rotate(45deg);
        line-height: 1;
      ">❤️</span>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
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
      (p) =>
        typeof p.latitude === "number" &&
        typeof p.longitude === "number" &&
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude)
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

  // Fly to selected place when user clicks card or favorite
  useEffect(() => {
    if (selectedPlace && selectedPlace !== prevSelectedRef.current) {
      prevSelectedRef.current = selectedPlace;
      const target = places.find(
        (p) => p.name.toLowerCase().trim() === selectedPlace.toLowerCase().trim()
      );
      if (
        target &&
        typeof target.latitude === "number" &&
        typeof target.longitude === "number" &&
        Number.isFinite(target.latitude) &&
        Number.isFinite(target.longitude)
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

export interface TripMapProps {
  city: string;
  places: Place[];
  selectedPlace?: string | null;
  onSelectPlace?: (placeName: string) => void;
  className?: string;
  favoritePlaces?: FavoritePlace[];
  showFavorites?: boolean;
  onToggleFavorites?: (show: boolean) => void;
}

export default function TripMap({
  city,
  places,
  selectedPlace,
  onSelectPlace,
  className = "w-full h-full min-h-[380px] rounded-2xl",
  favoritePlaces = [],
  showFavorites = false,
  onToggleFavorites,
}: TripMapProps) {
  const center = CITY_CENTERS[city] ?? [24.7136, 46.6753];
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localShowFavorites, setLocalShowFavorites] = useState(showFavorites);
  const markerRefs = useRef<Record<string, L.Marker>>({});

  useEffect(() => {
    setLocalShowFavorites(showFavorites);
  }, [showFavorites]);

  const activeShowFavorites = onToggleFavorites ? showFavorites : localShowFavorites;

  // Build combined markers list
  // 1. Existing places with valid coordinates
  const validPlaces = places.filter(
    (p) =>
      typeof p.latitude === "number" &&
      typeof p.longitude === "number" &&
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude)
  );

  // Set of favorite place names (lowercase for robust matching)
  const favNameSet = new Set(
    favoritePlaces.map((f) => f.name.toLowerCase().trim())
  );

  // 2. Extra favorites for this city not present in validPlaces
  const extraFavorites: Place[] = [];
  if (activeShowFavorites) {
    const cityNorm = city.toLowerCase().trim();
    for (const fav of favoritePlaces) {
      const favCity = (fav.city || "").toLowerCase().trim();
      const isCurrentCity = favCity === cityNorm || favCity === "saudi arabia" || favCity === "";
      if (
        isCurrentCity &&
        typeof fav.latitude === "number" &&
        typeof fav.longitude === "number" &&
        Number.isFinite(fav.latitude) &&
        Number.isFinite(fav.longitude)
      ) {
        const alreadyInPlaces = validPlaces.some(
          (p) => p.name.toLowerCase().trim() === fav.name.toLowerCase().trim()
        );
        if (!alreadyInPlaces) {
          extraFavorites.push({
            name: fav.name,
            category: (fav.category as any) || "attractions",
            estimated_cost: fav.estimated_cost,
            address: fav.address,
            image_url: fav.image_url,
            latitude: fav.latitude,
            longitude: fav.longitude,
            source: fav.source,
          });
        }
      }
    }
  }

  const allDisplayPlaces = [...validPlaces, ...extraFavorites];

  // Automatically open popup of selected place
  useEffect(() => {
    if (selectedPlace && markerRefs.current[selectedPlace]) {
      markerRefs.current[selectedPlace].openPopup();
    }
  }, [selectedPlace]);

  function handleToggleFav() {
    const next = !activeShowFavorites;
    setLocalShowFavorites(next);
    if (onToggleFavorites) onToggleFavorites(next);
  }

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

        <MapController places={allDisplayPlaces} selectedPlace={selectedPlace} city={city} />

        {allDisplayPlaces.map((p, i) => {
          const isSelected = selectedPlace?.toLowerCase().trim() === p.name.toLowerCase().trim();
          const isFav = favNameSet.has(p.name.toLowerCase().trim());
          const useFavIcon = activeShowFavorites && isFav;

          let iconToUse: L.DivIcon | L.Icon = defaultIcon;
          if (useFavIcon) {
            iconToUse = isSelected ? selectedFavoriteIcon : favoriteIcon;
          } else if (isSelected) {
            iconToUse = selectedIcon;
          }

          return (
            <Marker
              key={`${p.name}-${i}`}
              position={[p.latitude!, p.longitude!]}
              icon={iconToUse}
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
                <div className="p-1 max-w-[220px]">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-ink-900 text-sm">{p.name}</p>
                    {isFav && <span title="Saved in Favorites">❤️</span>}
                  </div>
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

      {/* Top Map Control Actions */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
        {/* Toggle Favorites on Map */}
        {favoritePlaces.length > 0 && (
          <button
            onClick={handleToggleFav}
            className={`px-3 py-1.5 rounded-xl shadow-md border transition flex items-center gap-1.5 text-xs font-body font-medium backdrop-blur-sm ${
              activeShowFavorites
                ? "bg-rose-50 border-rose-300 text-rose-700 font-semibold"
                : "bg-white/90 hover:bg-white text-ink-700 border-ink-900/10"
            }`}
            title={activeShowFavorites ? "Hide favorite markers" : "Show favorite markers on map"}
            aria-label="Show Favorites on Map"
          >
            <Heart className={`w-3.5 h-3.5 ${activeShowFavorites ? "text-rose-600 fill-rose-600" : "text-ink-700"}`} />
            <span>{activeShowFavorites ? "Favorites Shown" : "Show Favorites on Map"}</span>
          </button>
        )}

        {/* Expand / Fullscreen Map Toggle Button */}
        <button
          onClick={() => setIsFullscreen((prev) => !prev)}
          className="bg-white/90 hover:bg-white text-ink-900 p-2 rounded-xl shadow-md border border-ink-900/10 transition flex items-center gap-1.5 text-xs font-body font-medium"
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
