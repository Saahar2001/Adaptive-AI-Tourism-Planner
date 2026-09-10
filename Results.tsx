import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTrip } from "../lib/TripContext";
import TripMap from "../components/TripMap";
import PlaceCard from "../components/PlaceCard";
import { TripStorageService } from "../lib/trips";
import { FavoritesService } from "../lib/favorites";
import type { PlaceCategory, FavoritePlace } from "../lib/types";
import {
  Clock,
  Compass,
  Heart,
  Calendar,
  DollarSign,
  AlertCircle,
  MapPin,
} from "lucide-react";

const CATEGORY_TABS: { value: PlaceCategory; label: string }[] = [
  { value: "attractions", label: "📍 Attractions" },
  { value: "restaurants", label: "🍽️ Restaurants" },
  { value: "cafes", label: "☕ Cafés" },
];

export default function Results() {
  const navigate = useNavigate();
  const { prefs, result } = useTrip();
  const [activeDay, setActiveDay] = useState(1);
  const [activeCategory, setActiveCategory] = useState<PlaceCategory>("attractions");
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [favorites, setFavorites] = useState<FavoritePlace[]>(() => FavoritesService.getUserFavorites());
  const [showFavoritesOnMap, setShowFavoritesOnMap] = useState(false);

  // References to scroll cards into view
  const stopRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    function refreshFavs() {
      setFavorites(FavoritesService.getUserFavorites());
    }
    window.addEventListener("favorites-changed", refreshFavs);
    return () => window.removeEventListener("favorites-changed", refreshFavs);
  }, []);

  useEffect(() => {
    if (!prefs || !result) {
      navigate("/plan");
    } else {
      // Auto-save successful trip to local TripStorageService
      TripStorageService.saveTrip(prefs, result);
    }
  }, [prefs, result, navigate]);

  if (!prefs || !result) return null;

  const availableCategories = CATEGORY_TABS
    .map((tab) => tab.value)
    .filter((category) => result.places.some((place) => place.category === category));

  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.includes(activeCategory)) {
      setActiveCategory(availableCategories[0]);
    }
  }, [activeCategory, availableCategories]);

  useEffect(() => {
    if (result.itinerary.length > 0 && !result.itinerary.some((item) => item.day === activeDay)) {
      setActiveDay(result.itinerary[0].day);
    }
  }, [activeDay, result.itinerary]);

  const day = result.itinerary.find((d) => d.day === activeDay) ?? result.itinerary[0];
  const placesForCategory = result.places.filter((p) => p.category === activeCategory);

  // City-relevant favorites
  const cityFavorites = favorites.filter((fav) => {
    const fc = (fav.city || "").toLowerCase().trim();
    const cur = (prefs.city || "").toLowerCase().trim();
    return fc === cur || fc === "saudi arabia" || fc === "";
  });

  // When a place is selected (from map marker click or card click), scroll card into view if practical
  function handleSelectPlace(placeName: string) {
    setSelectedPlace(placeName);
    const el = stopRefs.current[placeName];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function handleSelectFavorite(fav: FavoritePlace) {
    setSelectedPlace(fav.name);
    // If favorite has valid coordinates, ensure favorites are shown on map to focus
    if (typeof fav.latitude === "number" && typeof fav.longitude === "number") {
      setShowFavoritesOnMap(true);
    }
    const el = stopRefs.current[fav.name];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function handleSaveTripManual() {
    if (prefs && result) {
      TripStorageService.saveTrip(prefs, result);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  }

  return (
    <div className="min-h-screen bg-sand-100">
      {/* Subheader action bar */}
      <div className="bg-sand-50 border-b border-ink-900/10">
        <div className="max-w-content mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-body text-palm-700 font-semibold uppercase tracking-wider">
              <span>Verified Saudi Itinerary</span>
              <span>•</span>
              <span>{prefs.city}</span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl text-ink-900 mt-0.5">
              Your {prefs.days}-day trip to {prefs.city}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSaveTripManual}
              className="text-xs md:text-sm font-body font-medium text-ink-700 hover:text-ink-900 bg-white border border-ink-900/15 rounded-full px-4 py-2 transition hover:border-palm-600 shadow-xs flex items-center gap-1.5"
            >
              <Heart className="w-3.5 h-3.5 text-red-500" />
              <span>{savedSuccess ? "Saved to My Trips!" : "Save Trip"}</span>
            </button>
            <button
              onClick={() => navigate("/plan")}
              className="text-xs md:text-sm font-body font-medium text-palm-700 border border-palm-600 rounded-full px-5 py-2 hover:bg-palm-50 transition-colors shadow-xs"
            >
              🔄 Modify plan
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-content mx-auto px-6 py-8">
        {/* Trip Overview Chips */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-700 font-body">
          <span className="bg-white/80 border border-ink-900/10 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-palm-700" /> Budget {prefs.budget} SAR
          </span>
          <span className="bg-white/80 border border-ink-900/10 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-palm-700" /> {prefs.days} Days
          </span>
          <span className="bg-white/80 border border-ink-900/10 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-palm-700" /> {prefs.interests.join(", ") || "All Interests"}
          </span>
          {prefs.requireAccessibility && (
            <span className="bg-palm-50 border border-palm-600/30 text-palm-700 px-3 py-1.5 rounded-full text-xs font-semibold">
              ♿ Strict Accessibility Required
            </span>
          )}
        </div>

        {/* Informative non-alarming warnings */}
        {result.warnings && result.warnings.length > 0 && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50/80 border border-amber-200/70 space-y-1.5 text-xs text-amber-900 font-body">
            <div className="flex items-center gap-1.5 font-semibold text-amber-800">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Grounded Tourism Notes</span>
            </div>
            {result.warnings.map((warning, index) => (
              <p key={index} className="text-amber-800/90 pl-5">
                • {warning}
              </p>
            ))}
          </div>
        )}

        {/* Favorite Places Section (near top after trip summary) */}
        {cityFavorites.length > 0 && (
          <section className="mt-6 bg-white/70 border border-ink-900/10 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                <h2 className="font-display font-medium text-base text-ink-900">Favorite Places</h2>
                <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200 font-medium">
                  {cityFavorites.length} saved
                </span>
              </div>
              <button
                onClick={() => setShowFavoritesOnMap((prev) => !prev)}
                className={`text-xs px-3 py-1 rounded-full border transition flex items-center gap-1.5 ${
                  showFavoritesOnMap
                    ? "bg-rose-50 border-rose-300 text-rose-700 font-semibold"
                    : "bg-white border-ink-900/15 text-ink-700 hover:border-palm-600"
                }`}
              >
                <Heart className={`w-3 h-3 ${showFavoritesOnMap ? "fill-rose-600 text-rose-600" : ""}`} />
                <span>{showFavoritesOnMap ? "Favorites Shown on Map" : "Show Favorites on Map"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {cityFavorites.map((fav) => {
                const isSelected = selectedPlace?.toLowerCase().trim() === fav.name.toLowerCase().trim();
                const hasCoords =
                  typeof fav.latitude === "number" &&
                  typeof fav.longitude === "number" &&
                  Number.isFinite(fav.latitude) &&
                  Number.isFinite(fav.longitude);

                return (
                  <div
                    key={fav.id}
                    onClick={() => handleSelectFavorite(fav)}
                    className={`group p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/30 shadow-xs"
                        : "border-ink-900/10 bg-white hover:border-palm-600/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="font-semibold text-xs text-ink-900 group-hover:text-palm-700 line-clamp-1">
                          {fav.name}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            FavoritesService.removeFavorite(fav.id);
                          }}
                          className="text-ink-700/40 hover:text-red-500 p-0.5"
                          title="Remove from favorites"
                        >
                          <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                        </button>
                      </div>
                      <p className="text-[11px] text-palm-700 capitalize mt-0.5">
                        {fav.category} • {fav.city}
                      </p>
                      {fav.address && (
                        <p className="text-[10px] text-ink-700/60 mt-1 line-clamp-1">
                          {fav.address}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-ink-900/5 text-[10px]">
                      {typeof fav.estimated_cost === "number" ? (
                        <span className="font-medium text-palm-700">Est. {fav.estimated_cost} SAR</span>
                      ) : (
                        <span />
                      )}
                      {hasCoords ? (
                        <span className="text-palm-700 font-medium">📍 Focus Map</span>
                      ) : (
                        <span className="text-ink-700/40">No map pin</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid lg:grid-cols-[1fr_440px] gap-8 mt-8">
          <div>
            {/* Day tabs */}
            <div className="flex items-center gap-2 border-b border-ink-900/10 mb-6 overflow-x-auto no-scrollbar">
              {result.itinerary.map((d) => (
                <button
                  key={d.day}
                  onClick={() => {
                    setActiveDay(d.day);
                    setSelectedPlace(null);
                  }}
                  className={`px-4 py-2.5 font-body text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activeDay === d.day
                      ? "border-palm-600 text-palm-700 font-semibold"
                      : "border-transparent text-ink-700/60 hover:text-ink-900"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" /> Day {d.day}
                </button>
              ))}
            </div>

            {/* Current Day Itinerary Stops */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-medium text-lg text-ink-900">
                  Day {activeDay} Schedule ({day?.stops.length || 0} stops)
                </h2>
                <span className="text-xs text-ink-700/60 font-body">Click stop to center map</span>
              </div>

              <ol className="space-y-3">
                {day?.stops.map((stop, i) => {
                  const isSelected = selectedPlace?.toLowerCase().trim() === stop.place.toLowerCase().trim();
                  const isFav = FavoritesService.isFavorite(stop.place, prefs.city);

                  return (
                    <li
                      key={i}
                      ref={(el) => {
                        stopRefs.current[stop.place] = el;
                      }}
                      onClick={() => handleSelectPlace(stop.place)}
                      className={`border rounded-xl p-4 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-palm-600 ring-2 ring-palm-600/30 bg-palm-50/40 shadow-sm"
                          : "border-ink-900/10 bg-white/70 hover:border-palm-600/60 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-7 h-7 rounded-full bg-palm-600 text-sand-50 flex items-center justify-center font-body text-xs font-bold shrink-0 mt-0.5 shadow-xs">
                            {i + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-body font-semibold text-ink-900 text-base">
                                {stop.place}
                              </p>
                              <span className="text-xs text-palm-700 capitalize font-medium bg-palm-50 px-2 py-0.5 rounded-full border border-palm-600/10">
                                {stop.category}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-700/75 mt-1">
                              {stop.visit_duration_hours && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-ink-700/50" />
                                  {stop.visit_duration_hours}h visit
                                </span>
                              )}
                              {stop.travel_distance_km ? (
                                <span>• {stop.travel_distance_km.toFixed(1)} km from prev</span>
                              ) : null}
                              {stop.route_method && (
                                <span className="capitalize">• {stop.route_method}</span>
                              )}
                            </div>

                            {/* Verification badges */}
                            <div className="flex items-center gap-3 text-[11px] text-ink-700/60 mt-2">
                              <span>
                                {stop.opening_hours_status && stop.opening_hours_status !== "unknown"
                                  ? `Hours: ${stop.opening_hours_status}`
                                  : "Opening hours unknown"}
                              </span>
                              <span>•</span>
                              <span>
                                {stop.accessibility_status === "yes"
                                  ? "Accessibility verified"
                                  : "Accessibility unknown"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {typeof stop.estimated_cost === "number" && (
                            <span className="text-xs text-palm-700 font-bold whitespace-nowrap bg-palm-50 px-2.5 py-1 rounded-lg border border-palm-600/15">
                              Est. {stop.estimated_cost} SAR
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const match = result.places.find(
                                (p) => p.name.toLowerCase().trim() === stop.place.toLowerCase().trim()
                              );
                              FavoritesService.toggleFavorite({
                                id: stop.place,
                                name: stop.place,
                                city: prefs.city,
                                category: stop.category,
                                estimated_cost: stop.estimated_cost,
                                address: match?.address,
                                image_url: match?.image_url,
                                latitude: match?.latitude,
                                longitude: match?.longitude,
                                source: match?.source,
                              });
                            }}
                            className="p-1 text-ink-700/40 hover:text-red-500 transition"
                            title="Bookmark place"
                            aria-label="Bookmark place"
                          >
                            <Heart className={`w-4 h-4 ${isFav ? "text-red-500 fill-red-500" : ""}`} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                }) ?? (
                  <p className="text-ink-700 font-body">No itinerary stops yet for this day.</p>
                )}
              </ol>
            </div>

            {/* Category tabs for recommended places */}
            <div className="mt-12 pt-8 border-t border-ink-900/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display font-medium text-xl text-ink-900">
                    Ranked Recommendations
                  </h2>
                  <p className="text-xs text-ink-700/70">
                    Ranked by contextual demand, preference match, and distance
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
                {CATEGORY_TABS.filter((tab) => availableCategories.includes(tab.value)).map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveCategory(tab.value)}
                    className={`px-4 py-2 rounded-full text-sm font-body border transition-all ${
                      activeCategory === tab.value
                        ? "bg-palm-600 border-palm-600 text-sand-50 shadow-xs font-medium"
                        : "bg-white border-ink-900/15 text-ink-700 hover:border-palm-600"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {placesForCategory.length ? (
                  placesForCategory.map((p, i) => (
                    <PlaceCard
                      key={`${p.name}-${i}`}
                      place={p}
                      city={prefs.city}
                      isSelected={selectedPlace === p.name}
                      onSelect={() => handleSelectPlace(p.name)}
                    />
                  ))
                ) : (
                  <p className="text-ink-700 font-body text-sm col-span-2 py-4">
                    No {activeCategory} found for this trip.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Synchronized Map */}
          <div className="h-[460px] lg:h-[calc(100vh-140px)] lg:sticky lg:top-24">
            <div className="bg-white p-2 rounded-2xl border border-ink-900/10 shadow-sm h-full flex flex-col">
              <div className="px-3 py-2 flex items-center justify-between text-xs text-ink-700/70 border-b border-ink-900/5 mb-1">
                <span className="flex items-center gap-1 font-semibold text-ink-900">
                  <MapPin className="w-3.5 h-3.5 text-palm-700" /> {prefs.city} Interactive Map
                </span>
                <span>{selectedPlace ? `Selected: ${selectedPlace}` : "Click pin to focus"}</span>
              </div>
              <div className="flex-1 relative rounded-xl overflow-hidden">
                <TripMap
                  city={prefs.city}
                  places={result.places}
                  selectedPlace={selectedPlace}
                  onSelectPlace={handleSelectPlace}
                  favoritePlaces={favorites}
                  showFavorites={showFavoritesOnMap}
                  onToggleFavorites={setShowFavoritesOnMap}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
