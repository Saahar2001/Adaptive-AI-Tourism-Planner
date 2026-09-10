import React, { useState, useEffect } from "react";
import { Heart, MapPin, ImageOff, CheckCircle2, HelpCircle } from "lucide-react";
import type { Place } from "../lib/types";
import { FavoritesService } from "../lib/favorites";

const CATEGORY_ICON: Record<string, string> = {
  attractions: "📍",
  restaurants: "🍽️",
  cafes: "☕",
};

interface PlaceCardProps {
  place: Place;
  isSelected?: boolean;
  onSelect?: () => void;
  city?: string;
}

export default function PlaceCard({ place, isSelected = false, onSelect, city }: PlaceCardProps) {
  const [imgError, setImgError] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  useEffect(() => {
    setIsFav(FavoritesService.isFavorite(place.name, city));
    function handleFavChange() {
      setIsFav(FavoritesService.isFavorite(place.name, city));
    }
    window.addEventListener("favorites-changed", handleFavChange);
    return () => window.removeEventListener("favorites-changed", handleFavChange);
  }, [place.name, city]);

  function handleToggleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    const added = FavoritesService.toggleFavorite({
      id: place.name,
      name: place.name,
      city: city || "Saudi Arabia",
      category: place.category,
      estimated_cost: place.estimated_cost,
      address: place.address,
      image_url: place.image_url,
      latitude: place.latitude,
      longitude: place.longitude,
      source: place.source,
    });
    setIsFav(added);
  }

  const showImage = Boolean(place.image_url && !imgError);

  return (
    <div
      onClick={onSelect}
      className={`group border rounded-xl overflow-hidden bg-white/70 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
        isSelected
          ? "border-palm-600 ring-2 ring-palm-600/30 shadow-md bg-palm-50/20"
          : "border-ink-900/10 hover:border-palm-600/60 hover:shadow-sm"
      }`}
    >
      {/* Card Image Thumbnail if available or subtle placeholder */}
      {showImage ? (
        <div className="h-36 w-full bg-sand-200/40 relative overflow-hidden">
          <img
            src={place.image_url!}
            alt={place.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <button
            onClick={handleToggleFavorite}
            className={`absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-md transition-all shadow-xs ${
              isFav ? "bg-red-500 text-white" : "bg-black/30 text-white hover:bg-black/50"
            }`}
            title={isFav ? "Remove bookmark" : "Bookmark venue"}
            aria-label="Bookmark place"
          >
            <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-white" : ""}`} />
          </button>
        </div>
      ) : null}

      <div className="p-4 flex flex-col justify-between flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm" role="img" aria-label={place.category}>
                {CATEGORY_ICON[place.category] || "📍"}
              </span>
              <p className="font-body font-semibold text-ink-900 text-sm group-hover:text-palm-700 transition-colors">
                {place.name}
              </p>
            </div>
            {place.address && (
              <p className="text-xs text-ink-700/70 mt-1 flex items-center gap-1 line-clamp-2">
                <MapPin className="w-3 h-3 text-ink-700/50 shrink-0" />
                <span>{place.address}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {!showImage && (
              <button
                onClick={handleToggleFavorite}
                className={`p-1.5 rounded-full border transition-all ${
                  isFav
                    ? "border-red-400 bg-red-50 text-red-500"
                    : "border-ink-900/10 text-ink-700/50 hover:text-red-500 hover:border-red-300"
                }`}
                title={isFav ? "Remove bookmark" : "Bookmark venue"}
                aria-label="Bookmark place"
              >
                <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-red-500" : ""}`} />
              </button>
            )}
            {typeof place.estimated_cost === "number" && (
              <span className="text-xs text-palm-700 font-semibold whitespace-nowrap bg-palm-50 px-2 py-0.5 rounded-md border border-palm-600/15">
                Est. {place.estimated_cost} SAR
              </span>
            )}
          </div>
        </div>

        {/* Badges footer */}
        <div className="mt-3 pt-2.5 border-t border-ink-900/5 flex items-center justify-between text-[11px] text-ink-700/60">
          <div className="flex items-center gap-2">
            {place.accessibility_status === "yes" ? (
              <span className="flex items-center gap-1 text-palm-700 font-medium" title="Accessibility verified">
                <CheckCircle2 className="w-3 h-3" /> Accessible
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-ink-700/50" title="Accessibility unknown">
                <HelpCircle className="w-2.5 h-2.5" /> Access unverified
              </span>
            )}
          </div>
          {typeof place.recommendation_score === "number" && (
            <span className="text-[10px] bg-sand-200/50 px-1.5 py-0.5 rounded text-ink-700">
              Score {Math.round(place.recommendation_score * 100)}%
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setShowWhy((value) => !value);
          }}
          className="mt-3 text-left text-[11px] font-semibold text-palm-700 hover:text-palm-800"
          aria-expanded={showWhy}
        >
          {showWhy ? "Hide recommendation details" : "Why recommended?"}
        </button>
        {showWhy && (
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-sand-50 border border-ink-900/5 p-2.5 text-[10px] text-ink-700">
            <span>Preference <strong>{Math.round((place.preference_match ?? 0) * 100)}%</strong></span>
            <span>Regional Demand <strong>{Math.round((place.regional_demand ?? 0) * 100)}%</strong></span>
            <span>Seasonality <strong>{Math.round((place.seasonality ?? 0) * 100)}%</strong></span>
            <span>Distance <strong>{Math.round((place.distance_fit ?? 0) * 100)}%</strong></span>
            <span className="col-span-2">Estimated Budget Fit <strong>{Math.round((place.budget_fit ?? 0) * 100)}%</strong></span>
            <span className="col-span-2 text-ink-700/60">Budget fit uses category-level estimated costs.</span>
          </div>
        )}
      </div>
    </div>
  );
}
