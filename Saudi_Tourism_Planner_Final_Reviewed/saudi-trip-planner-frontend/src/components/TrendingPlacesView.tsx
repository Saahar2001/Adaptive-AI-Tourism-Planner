import React, { useEffect, useState } from 'react';
import { Flame, MapPin, Tag, ImageOff } from 'lucide-react';
import { API_BASE } from '../lib/api';

interface TrendingPlace {
  id: string;
  name: string;
  city: string;
  category: string;
  trend_score: number;
  score_basis?: string;
  image_url?: string | null;
}

export const TrendingPlacesView: React.FC = () => {
  const [places, setPlaces] = useState<TrendingPlace[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE}/api/dashboard/trending-places`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch trending places (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setPlaces(Array.isArray(data.trending_places) ? data.trending_places : []);
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="animate-pulse font-medium text-slate-500">Loading trending destinations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <p>No trending destinations available right now.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Trending Destinations
          </h1>
          <p className="text-sm text-slate-500">
            Curated destinations ranked with transparent contextual and location signals.
          </p>
        </div>
      </div>

      {/* Grid of Places */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {places.map((place, idx) => (
          <div
            key={place.id || idx}
            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
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
                className={`no-photo-placeholder ${place.image_url ? 'hidden' : ''} absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400`}
              >
                <ImageOff className="h-8 w-8" />
                <span className="text-xs">No photo available</span>
              </div>
            </div>

            {/* Place Details */}
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-slate-800 text-lg group-hover:text-emerald-600 transition">
                  {place.name}
                </h3>
                <div
                  className="flex items-center space-x-1 bg-amber-50 px-2 py-0.5 rounded text-amber-700 font-semibold text-sm"
                  title={place.score_basis || 'Transparent contextual trend score'}
                >
                  <Flame className="h-4 w-4 text-amber-500" />
                  <span>{Math.round(Math.max(0, Math.min(1, place.trend_score ?? 0)) * 100)}%</span>
                </div>
              </div>

              <div className="flex items-center space-x-4 text-xs text-slate-500">
                <div className="flex items-center space-x-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{place.city}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Tag className="h-3.5 w-3.5 text-slate-400" />
                  <span>{place.category}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
