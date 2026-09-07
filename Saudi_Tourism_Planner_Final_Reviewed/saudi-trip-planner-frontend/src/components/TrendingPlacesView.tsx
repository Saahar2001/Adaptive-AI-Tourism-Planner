import React, { useEffect, useState, useRef } from 'react';
import {
  Flame,
  MapPin,
  Tag,
  ImageOff,
  X,
  Compass,
  CheckCircle2,
  HelpCircle,
  Clock,
  Database,
  Heart,
  Map as MapIcon,
} from 'lucide-react';
import { API_BASE } from '../lib/api';
import TripMap from './TripMap';
import { FavoritesService } from '../lib/favorites';
import type { Place, FavoritePlace } from '../lib/types';

export interface TrendingPlace {
  id: string;
  name: string;
  city: string;
  category: string;
  trend_score: number;
  score_basis?: string;
  image_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  accessibility_status?: string | null;
  opening_hours?: string | null;
  source?: string | null;
  source_retrieved_at_utc?: string | null;
}

export const TrendingPlacesView: React.FC = () => {
  const [places, setPlaces] = useState<TrendingPlace[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Map states
  const [modalPlace, setModalPlace] = useState<TrendingPlace | null>(null);
  const [showMap, setShowMap] = useState<boolean>(false);
  const [selectedPlaceName, setSelectedPlaceName] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<FavoritePlace[]>(() => FavoritesService.getUserFavorites());

  const mapSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function refreshFavs() {
      setFavorites(FavoritesService.getUserFavorites());
    }
    window.addEventListener('favorites-changed', refreshFavs);
    return () => window.removeEventListener('favorites-changed', refreshFavs);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE}/api/dashboard/trending-places`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch trending places (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          const list = Array.isArray(data.trending_places) ? data.trending_places : [];
          setPlaces(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        console.error(err);
        setError('Unable to load trending destinations.');
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  function handleCardClick(place: TrendingPlace) {
    setModalPlace(place);
    setSelectedPlaceName(place.name);
  }

  function handleViewOnMap(place: TrendingPlace) {
    setSelectedPlaceName(place.name);
    setShowMap(true);
    setModalPlace(null);
    setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function handleMapSelectPlace(name: string) {
    setSelectedPlaceName(name);
    const found = places.find((p) => p.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (found) {
      setModalPlace(found);
    }
  }

  // Convert trending places to standard Place[] for TripMap
  const mapPlaces: Place[] = places
    .filter(
      (p) =>
        typeof p.latitude === 'number' &&
        typeof p.longitude === 'number' &&
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude)
    )
    .map((p) => ({
      name: p.name,
      category: (p.category as any) || 'attractions',
      address: p.address || undefined,
      image_url: p.image_url || undefined,
      latitude: p.latitude || undefined,
      longitude: p.longitude || undefined,
      source: p.source || undefined,
    }));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="animate-pulse font-medium text-slate-500 font-body">Loading trending destinations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500 font-body">
        <p>{error}</p>
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500 font-body">
        <p>No trending destinations available right now.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 font-display">
            Trending Destinations
          </h1>
          <p className="text-sm text-slate-500 font-body">
            Curated destinations ranked with transparent contextual and location signals.
          </p>
        </div>

        {mapPlaces.length > 0 && (
          <button
            onClick={() => {
              const next = !showMap;
              setShowMap(next);
              if (next) {
                setTimeout(() => {
                  mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
              }
            }}
            className={`px-4 py-2 rounded-full border text-xs font-body font-medium transition flex items-center gap-1.5 self-start sm:self-auto ${
              showMap
                ? 'bg-palm-600 border-palm-600 text-sand-50 shadow-xs'
                : 'bg-white border-ink-900/15 text-ink-700 hover:border-palm-600'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            <span>{showMap ? 'Hide Map' : 'Explore on Map'}</span>
          </button>
        )}
      </div>

      {/* Expandable Map Section */}
      {showMap && mapPlaces.length > 0 && (
        <div
          ref={mapSectionRef}
          className="bg-white p-3 rounded-2xl border border-ink-900/10 shadow-sm transition-all animate-in fade-in duration-300"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-ink-900/5 mb-2 text-xs font-body text-ink-700">
            <span className="font-semibold text-ink-900 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-palm-700" /> All Trending Destinations Map
            </span>
            <span>{selectedPlaceName ? `Selected: ${selectedPlaceName}` : 'Click pin to inspect venue'}</span>
          </div>
          <div className="h-[380px] w-full rounded-xl overflow-hidden">
            <TripMap
              city="Riyadh"
              places={mapPlaces}
              selectedPlace={selectedPlaceName}
              onSelectPlace={handleMapSelectPlace}
              favoritePlaces={favorites}
              showFavorites={true}
            />
          </div>
        </div>
      )}

      {/* Grid of Places */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {places.map((place, idx) => {
          const isFav = FavoritesService.isFavorite(place.name, place.city);
          return (
            <div
              key={place.id || idx}
              onClick={() => handleCardClick(place)}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md cursor-pointer flex flex-col justify-between"
            >
              {/* Destination Image */}
              <div className="h-48 w-full bg-slate-100 relative overflow-hidden">
                {place.image_url ? (
                  <img
                    src={place.image_url}
                    alt={place.name}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).parentElement
                        ?.querySelector('.no-photo-placeholder')
                        ?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div
                  className={`no-photo-placeholder ${place.image_url ? 'hidden' : ''} absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400 bg-sand-200/50`}
                >
                  <ImageOff className="h-8 w-8" />
                  <span className="text-xs font-body">No photo available</span>
                </div>

                {/* Bookmark Heart Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    FavoritesService.toggleFavorite({
                      id: place.id || place.name,
                      name: place.name,
                      city: place.city,
                      category: place.category,
                      address: place.address || undefined,
                      image_url: place.image_url || undefined,
                      latitude: place.latitude || undefined,
                      longitude: place.longitude || undefined,
                      source: place.source || undefined,
                    });
                  }}
                  className={`absolute top-3 right-3 p-1.5 rounded-full backdrop-blur-md shadow-xs transition ${
                    isFav ? 'bg-red-500 text-white' : 'bg-black/30 text-white hover:bg-black/50'
                  }`}
                  title={isFav ? 'Remove bookmark' : 'Bookmark place'}
                  aria-label="Bookmark place"
                >
                  <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-white' : ''}`} />
                </button>
              </div>

              {/* Place Details */}
              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-emerald-600 transition font-body">
                      {place.name}
                    </h3>
                    <div
                      className="flex items-center space-x-1 bg-amber-50 px-2 py-0.5 rounded text-amber-700 font-semibold text-sm shrink-0"
                      title={place.score_basis || 'Transparent contextual trend score'}
                    >
                      <Flame className="h-4 w-4 text-amber-500" />
                      <span>{Math.round(Math.max(0, Math.min(1, place.trend_score ?? 0)) * 100)}%</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-slate-500 mt-2 font-body">
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{place.city}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Tag className="h-3.5 w-3.5 text-slate-400" />
                      <span className="capitalize">{place.category}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-body">
                  <span>Click card for details</span>
                  <span className="text-emerald-600 font-medium group-hover:underline">View details →</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Verified Place Details Modal */}
      {modalPlace && (
        <div
          onClick={() => setModalPlace(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-sand-50 border border-ink-900/15 rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col font-body text-ink-900"
          >
            {/* Modal Image Header */}
            <div className="h-52 w-full bg-sand-200/50 relative overflow-hidden shrink-0">
              {modalPlace.image_url ? (
                <img
                  src={modalPlace.image_url}
                  alt={modalPlace.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement
                      ?.querySelector('.modal-no-photo')
                      ?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div
                className={`modal-no-photo ${modalPlace.image_url ? 'hidden' : ''} absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-ink-700/40 bg-sand-200/70`}
              >
                <ImageOff className="w-10 h-10" />
                <span className="text-xs font-medium">No verified photo available</span>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setModalPlace(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition shadow-md"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Category & City Chip */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <span className="bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium">
                  {modalPlace.city}
                </span>
                <span className="bg-palm-600/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium capitalize">
                  {modalPlace.category}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-ink-900 leading-tight">
                  {modalPlace.name}
                </h2>
                {modalPlace.address && (
                  <p className="text-xs text-ink-700/80 mt-1 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-palm-700 shrink-0 mt-0.5" />
                    <span>{modalPlace.address}</span>
                  </p>
                )}
              </div>

              {/* Trend Score & Transparent Context */}
              <div className="bg-white border border-ink-900/10 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-900 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-500" /> Contextual Trend Signal
                  </span>
                  <span className="text-sm font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    {Math.round(Math.max(0, Math.min(1, modalPlace.trend_score ?? 0)) * 100)}%
                  </span>
                </div>
                {modalPlace.score_basis && (
                  <p className="text-xs text-ink-700/75 leading-relaxed">
                    <strong>Why it is trending:</strong> {modalPlace.score_basis}
                  </p>
                )}
              </div>

              {/* Verified Venue Signals (strictly no fabricated ratings) */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white border border-ink-900/10 p-3 rounded-xl">
                  <span className="text-ink-700/60 block mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-palm-700" /> Accessibility
                  </span>
                  <span className="font-semibold text-ink-900">
                    {modalPlace.accessibility_status === 'yes' ? 'Confirmed Accessible' : 'Unknown / Unverified'}
                  </span>
                </div>

                <div className="bg-white border border-ink-900/10 p-3 rounded-xl">
                  <span className="text-ink-700/60 block mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-palm-700" /> Opening Hours
                  </span>
                  <span className="font-semibold text-ink-900">
                    {modalPlace.opening_hours && modalPlace.opening_hours !== 'unknown'
                      ? modalPlace.opening_hours
                      : 'Unknown / Unverified'}
                  </span>
                </div>
              </div>

              {/* Data Provenance */}
              <div className="bg-sand-100/70 border border-ink-900/10 p-3 rounded-xl text-xs text-ink-700/80 space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-ink-900">
                  <Database className="w-3.5 h-3.5 text-palm-700" />
                  <span>Data Source: {modalPlace.source || 'Curated Saudi Tourism Dataset'}</span>
                </div>
                <p className="text-[11px] text-ink-700/60">
                  Ground-truth venue records verified without fabricated ratings or synthetic reviews.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                {typeof modalPlace.latitude === 'number' && typeof modalPlace.longitude === 'number' && (
                  <button
                    onClick={() => handleViewOnMap(modalPlace)}
                    className="flex-1 bg-palm-600 hover:bg-palm-700 text-sand-50 py-2.5 px-4 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Compass className="w-4 h-4" /> View on Map
                  </button>
                )}

                <button
                  onClick={() => {
                    FavoritesService.toggleFavorite({
                      id: modalPlace.id || modalPlace.name,
                      name: modalPlace.name,
                      city: modalPlace.city,
                      category: modalPlace.category,
                      address: modalPlace.address || undefined,
                      image_url: modalPlace.image_url || undefined,
                      latitude: modalPlace.latitude || undefined,
                      longitude: modalPlace.longitude || undefined,
                      source: modalPlace.source || undefined,
                    });
                  }}
                  className={`py-2.5 px-4 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                    FavoritesService.isFavorite(modalPlace.name, modalPlace.city)
                      ? 'bg-rose-50 border-rose-300 text-rose-700'
                      : 'bg-white border-ink-900/15 text-ink-900 hover:border-palm-600'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${
                      FavoritesService.isFavorite(modalPlace.name, modalPlace.city)
                        ? 'fill-rose-600 text-rose-600'
                        : 'text-ink-700'
                    }`}
                  />
                  <span>
                    {FavoritesService.isFavorite(modalPlace.name, modalPlace.city)
                      ? 'Bookmarked'
                      : 'Save to Favorites'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
