import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FavoritesService } from "../lib/favorites";
import type { FavoritePlace, Place } from "../lib/types";
import TripMap from "../components/TripMap";
import {
  Heart,
  MapPin,
  Trash2,
  Compass,
  Map as MapIcon,
  Calendar,
  X,
  CheckCircle2,
  Database,
  ImageOff,
} from "lucide-react";

export default function Favorites() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoritePlace[]>(() => FavoritesService.getUserFavorites());
  const [selectedCity, setSelectedCity] = useState<string>("All");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedPlaceName, setSelectedPlaceName] = useState<string | null>(null);
  const [modalPlace, setModalPlace] = useState<FavoritePlace | null>(null);
  const [showMap, setShowMap] = useState(false);

  const mapSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function refresh() {
      setFavorites(FavoritesService.getUserFavorites());
    }
    window.addEventListener("favorites-changed", refresh);
    return () => window.removeEventListener("favorites-changed", refresh);
  }, []);

  function handleRemove(id: string) {
    FavoritesService.removeFavorite(id);
    setFavorites(FavoritesService.getUserFavorites());
    if (modalPlace?.id === id) setModalPlace(null);
  }

  function handleShowOnMap(fav: FavoritePlace) {
    setSelectedPlaceName(fav.name);
    setShowMap(true);
    setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function handleMapSelectPlace(name: string) {
    setSelectedPlaceName(name);
    const found = favorites.find((f) => f.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (found) {
      setModalPlace(found);
    }
  }

  // Filter options
  const cities = ["All", ...Array.from(new Set(favorites.map((f) => f.city).filter(Boolean)))];
  const categories = ["All", ...Array.from(new Set(favorites.map((f) => f.category).filter(Boolean)))];

  const filtered = favorites.filter((fav) => {
    const matchCity = selectedCity === "All" || fav.city === selectedCity;
    const matchCat = selectedCategory === "All" || fav.category === selectedCategory;
    return matchCity && matchCat;
  });

  // Places with valid coordinates for map
  const mapPlaces: Place[] = filtered
    .filter(
      (f) =>
        typeof f.latitude === "number" &&
        typeof f.longitude === "number" &&
        Number.isFinite(f.latitude) &&
        Number.isFinite(f.longitude)
    )
    .map((f) => ({
      name: f.name,
      category: (f.category as any) || "attractions",
      estimated_cost: f.estimated_cost,
      address: f.address,
      image_url: f.image_url,
      latitude: f.latitude,
      longitude: f.longitude,
      source: f.source,
    }));

  const mapCity = selectedCity !== "All" ? selectedCity : "Riyadh";

  return (
    <div className="min-h-screen bg-sand-100 py-10 font-body">
      <div className="max-w-content mx-auto px-6 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 uppercase tracking-wider">
              <Heart className="w-3.5 h-3.5 fill-rose-600" />
              <span>Saved Places</span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl text-ink-900 mt-1">
              Your Bookmarked Venues
            </h1>
            <p className="text-xs md:text-sm text-ink-700/70 mt-0.5">
              Saved attractions, dining, and cafes across Saudi Arabia for easy trip planning.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {mapPlaces.length > 0 && (
              <button
                onClick={() => {
                  const next = !showMap;
                  setShowMap(next);
                  if (next) {
                    setTimeout(() => {
                      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 100);
                  }
                }}
                className={`px-4 py-2 rounded-full border text-xs font-semibold transition flex items-center gap-1.5 shadow-xs ${
                  showMap
                    ? "bg-rose-50 border-rose-300 text-rose-700"
                    : "bg-white border-ink-900/15 text-ink-700 hover:border-palm-600"
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>{showMap ? "Hide Map" : "Show Favorites on Map"}</span>
              </button>
            )}
            <Link
              to="/plan"
              className="bg-palm-600 hover:bg-palm-700 text-sand-50 px-4 py-2 rounded-full text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Plan Trip</span>
            </Link>
          </div>
        </div>

        {/* Embedded Interactive Favorites Map */}
        {showMap && mapPlaces.length > 0 && (
          <div
            ref={mapSectionRef}
            className="bg-white p-3 rounded-2xl border border-ink-900/10 shadow-sm transition-all animate-in fade-in duration-300"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-ink-900/5 mb-2 text-xs text-ink-700">
              <span className="font-semibold text-ink-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-600" /> Bookmarked Venues Map ({mapPlaces.length} mapped)
              </span>
              <span>{selectedPlaceName ? `Selected: ${selectedPlaceName}` : "Click pin to view"}</span>
            </div>
            <div className="h-[380px] w-full rounded-xl overflow-hidden">
              <TripMap
                city={mapCity}
                places={mapPlaces}
                selectedPlace={selectedPlaceName}
                onSelectPlace={handleMapSelectPlace}
                favoritePlaces={filtered}
                showFavorites={true}
              />
            </div>
          </div>
        )}

        {/* Filter Controls */}
        {favorites.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white/70 border border-ink-900/10 p-4 rounded-2xl">
            {/* City Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-xs font-semibold text-ink-700 mr-1">City:</span>
              {cities.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCity(c)}
                  className={`px-3 py-1 rounded-full text-xs transition whitespace-nowrap ${
                    selectedCity === c
                      ? "bg-palm-600 text-sand-50 font-semibold shadow-xs"
                      : "bg-white border border-ink-900/10 text-ink-700 hover:border-palm-600"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-xs font-semibold text-ink-700 mr-1">Category:</span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs transition capitalize whitespace-nowrap ${
                    selectedCategory === cat
                      ? "bg-palm-600 text-sand-50 font-semibold shadow-xs"
                      : "bg-white border border-ink-900/10 text-ink-700 hover:border-palm-600"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {favorites.length === 0 ? (
          <div className="bg-white/80 border border-ink-900/10 rounded-3xl p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
              <Heart className="w-7 h-7 fill-rose-500" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-ink-900">No favorite places yet</h3>
              <p className="text-xs text-ink-700/70 mt-1.5 leading-relaxed">
                Save attractions, restaurants, and cafes while planning trips or browsing trending destinations.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                to="/plan"
                className="bg-palm-600 hover:bg-palm-700 text-sand-50 px-5 py-2 rounded-full text-xs font-semibold transition shadow-xs"
              >
                Plan a Trip
              </Link>
              <Link
                to="/trending"
                className="border border-ink-900/15 hover:border-palm-600 px-5 py-2 rounded-full text-xs font-semibold text-ink-700 transition"
              >
                Explore Trending
              </Link>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/60 border border-ink-900/10 rounded-2xl p-8 text-center text-xs text-ink-700/70">
            No saved places match the selected filters. Try choosing "All".
          </div>
        ) : (
          /* Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((fav) => {
              const hasCoords =
                typeof fav.latitude === "number" &&
                typeof fav.longitude === "number" &&
                Number.isFinite(fav.latitude) &&
                Number.isFinite(fav.longitude);

              return (
                <div
                  key={fav.id}
                  className="bg-white border border-ink-900/10 rounded-2xl overflow-hidden shadow-xs hover:border-palm-600/50 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  {/* Thumbnail */}
                  <div className="h-40 w-full bg-sand-200/40 relative overflow-hidden">
                    {fav.image_url ? (
                      <img
                        src={fav.image_url}
                        alt={fav.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).parentElement
                            ?.querySelector(".fav-no-photo")
                            ?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div
                      className={`fav-no-photo ${fav.image_url ? "hidden" : ""} absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink-700/40 bg-sand-200/60`}
                    >
                      <ImageOff className="w-8 h-8" />
                      <span className="text-[11px]">No photo available</span>
                    </div>

                    <button
                      onClick={() => handleRemove(fav.id)}
                      className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 hover:bg-red-500 text-white backdrop-blur-md transition shadow-xs"
                      title="Remove from favorites"
                      aria-label="Remove favorite"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <span className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-0.5 rounded-full capitalize">
                      {fav.category} • {fav.city}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="font-bold text-ink-900 text-base leading-snug group-hover:text-palm-700 transition">
                        {fav.name}
                      </h3>
                      {fav.address && (
                        <p className="text-xs text-ink-700/70 mt-1 flex items-start gap-1 line-clamp-2">
                          <MapPin className="w-3 h-3 text-ink-700/50 shrink-0 mt-0.5" />
                          <span>{fav.address}</span>
                        </p>
                      )}
                    </div>

                    {typeof fav.estimated_cost === "number" && (
                      <div className="text-xs text-palm-700 font-semibold bg-palm-50/70 px-2.5 py-1 rounded-lg border border-palm-600/10 w-fit">
                        Est. {fav.estimated_cost} SAR
                      </div>
                    )}

                    {/* Actions Bar */}
                    <div className="pt-3 border-t border-ink-900/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setModalPlace(fav)}
                          className="font-medium text-ink-900 hover:text-palm-700 underline underline-offset-2"
                        >
                          View Details
                        </button>
                        {hasCoords && (
                          <>
                            <span className="text-ink-900/20">•</span>
                            <button
                              onClick={() => handleShowOnMap(fav)}
                              className="font-medium text-palm-700 hover:text-palm-800 flex items-center gap-0.5"
                            >
                              <MapPin className="w-3 h-3" /> Show on Map
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => navigate(`/plan?city=${encodeURIComponent(fav.city)}`)}
                        className="text-palm-700 font-semibold hover:underline flex items-center gap-1"
                        title={`Create an itinerary in ${fav.city}`}
                      >
                        <Calendar className="w-3 h-3" /> Plan in {fav.city}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Place Details Modal */}
        {modalPlace && (
          <div
            onClick={() => setModalPlace(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-sand-50 border border-ink-900/15 rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col font-body text-ink-900"
            >
              <div className="h-48 w-full bg-sand-200/50 relative overflow-hidden shrink-0">
                {modalPlace.image_url ? (
                  <img src={modalPlace.image_url} alt={modalPlace.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink-700/40">
                    <ImageOff className="w-8 h-8" />
                    <span className="text-xs">No photo available</span>
                  </div>
                )}
                <button
                  onClick={() => setModalPlace(null)}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition shadow-md"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <span className="bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium">
                    {modalPlace.city}
                  </span>
                  <span className="bg-palm-600/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium capitalize">
                    {modalPlace.category}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <h2 className="font-display text-2xl font-bold text-ink-900">{modalPlace.name}</h2>
                  {modalPlace.address && (
                    <p className="text-xs text-ink-700/80 mt-1 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-palm-700 shrink-0 mt-0.5" />
                      <span>{modalPlace.address}</span>
                    </p>
                  )}
                </div>

                {typeof modalPlace.estimated_cost === "number" && (
                  <div className="bg-white border border-ink-900/10 p-3 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-ink-700/70">Estimated Cost</span>
                    <span className="font-bold text-palm-700">{modalPlace.estimated_cost} SAR</span>
                  </div>
                )}

                <div className="bg-sand-100/70 border border-ink-900/10 p-3 rounded-xl text-xs text-ink-700/80 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-ink-900">
                    <Database className="w-3.5 h-3.5 text-palm-700" />
                    <span>Data Source: {modalPlace.source || "Curated Saudi Tourism Dataset"}</span>
                  </div>
                  <p className="text-[11px] text-ink-700/60">
                    Grounded place record with zero fabricated reviews or synthetic star ratings.
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  {typeof modalPlace.latitude === "number" && typeof modalPlace.longitude === "number" && (
                    <button
                      onClick={() => {
                        handleShowOnMap(modalPlace);
                        setModalPlace(null);
                      }}
                      className="flex-1 bg-palm-600 hover:bg-palm-700 text-sand-50 py-2.5 px-4 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <MapPin className="w-4 h-4" /> Show on Map
                    </button>
                  )}
                  <button
                    onClick={() => {
                      navigate(`/plan?city=${encodeURIComponent(modalPlace.city)}`);
                    }}
                    className="flex-1 border border-palm-600 text-palm-700 hover:bg-palm-50 py-2.5 px-4 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <Calendar className="w-4 h-4" /> Plan Trip in {modalPlace.city}
                  </button>
                  <button
                    onClick={() => handleRemove(modalPlace.id)}
                    className="p-2.5 border border-rock-600/20 text-rock-600 hover:bg-rock-50 rounded-xl transition"
                    title="Remove favorite"
                    aria-label="Remove favorite"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
