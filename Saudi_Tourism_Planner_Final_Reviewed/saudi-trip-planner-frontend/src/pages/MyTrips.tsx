import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TripStorageService } from "../lib/trips";
import { useTrip } from "../lib/TripContext";
import type { SavedTrip } from "../lib/types";
import {
  Compass,
  Calendar,
  DollarSign,
  MapPin,
  Trash2,
  ExternalLink,
  RotateCcw,
  Briefcase,
  ChevronRight,
} from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function MyTrips() {
  const navigate = useNavigate();
  const { setPrefs, setResult } = useTrip();
  const [trips, setTrips] = useState<SavedTrip[]>(TripStorageService.getUserTrips());

  useEffect(() => {
    function refresh() {
      setTrips(TripStorageService.getUserTrips());
    }
    window.addEventListener("trips-changed", refresh);
    return () => window.removeEventListener("trips-changed", refresh);
  }, []);

  function handleOpenTrip(t: SavedTrip) {
    setPrefs(t.prefs);
    setResult(t.result);
    navigate("/results");
  }

  function handleModifyTrip(t: SavedTrip) {
    setPrefs(t.prefs);
    navigate("/plan");
  }

  function handleDeleteTrip(id: string) {
    if (confirm("Are you sure you want to remove this saved trip?")) {
      TripStorageService.deleteTrip(id);
      setTrips(TripStorageService.getUserTrips());
    }
  }

  return (
    <div className="min-h-screen bg-sand-100 py-10">
      <div className="max-w-content mx-auto px-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ink-900 flex items-center gap-2.5">
              <Briefcase className="w-7 h-7 text-palm-700" />
              <span>My Saved Journeys</span>
            </h1>
            <p className="font-body text-xs text-ink-700/70 mt-1">
              All generated itineraries are saved locally. Open them instantly without re-querying the API.
            </p>
          </div>

          <Link
            to="/plan"
            className="bg-palm-600 hover:bg-palm-700 text-sand-50 font-body text-xs font-semibold px-5 py-2.5 rounded-full transition shadow-xs w-fit"
          >
            + Plan New Trip
          </Link>
        </div>

        {trips.length === 0 ? (
          <div className="bg-white/70 border border-ink-900/10 rounded-3xl p-12 text-center text-ink-700/70 font-body">
            <Compass className="w-12 h-12 text-ink-700/30 mx-auto mb-3" />
            <h3 className="font-display text-lg text-ink-900">No saved trips yet</h3>
            <p className="text-xs max-w-md mx-auto mt-1">
              When you plan and generate an itinerary, it will be safely saved here so you can view it anytime.
            </p>
            <Link
              to="/plan"
              className="inline-block mt-5 bg-palm-600 hover:bg-palm-700 text-sand-50 font-body text-xs font-semibold px-6 py-3 rounded-full transition shadow-xs"
            >
              Generate Your First Trip
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {trips.map((t) => {
              const totalStops = t.result.itinerary.reduce(
                (sum, day) => sum + (day.stops?.length || 0),
                0
              );
              const previewStops = t.result.itinerary
                .flatMap((d) => d.stops)
                .slice(0, 3)
                .map((s) => s.place);

              const formattedDate = new Date(t.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              const monthLabel = t.prefs.tripMonth
                ? MONTH_NAMES[t.prefs.tripMonth - 1]
                : "Year-Round";

              return (
                <div
                  key={t.id}
                  className="bg-white/80 border border-ink-900/10 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-palm-600/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-palm-700 font-semibold uppercase tracking-wider">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{t.prefs.city}</span>
                        </div>
                        <h2 className="font-display text-xl text-ink-900 mt-1">
                          {t.prefs.days}-Day Journey
                        </h2>
                      </div>
                      <span className="text-[11px] text-ink-700/50 bg-sand-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                        Saved {formattedDate}
                      </span>
                    </div>

                    {/* Metadata Chips */}
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs font-body text-ink-700">
                      <span className="bg-sand-50 border border-ink-900/10 px-2.5 py-1 rounded-lg">
                        💰 {t.prefs.budget} SAR
                      </span>
                      <span className="bg-sand-50 border border-ink-900/10 px-2.5 py-1 rounded-lg">
                        🗓️ {monthLabel}
                      </span>
                      <span className="bg-sand-50 border border-ink-900/10 px-2.5 py-1 rounded-lg">
                        🚗 {t.prefs.transport}
                      </span>
                    </div>

                    {/* Compact Itinerary Summary */}
                    <div className="mt-4 pt-4 border-t border-ink-900/5 font-body text-xs">
                      <p className="text-ink-700/60 font-medium mb-1.5">
                        Itinerary highlights ({totalStops} stops planned):
                      </p>
                      <ul className="space-y-1 text-ink-900">
                        {previewStops.map((place, idx) => (
                          <li key={idx} className="truncate flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-palm-600 shrink-0" />
                            <span>{place}</span>
                          </li>
                        ))}
                        {totalStops > 3 && (
                          <li className="text-ink-700/50 text-[11px] pl-3">
                            + {totalStops - 3} more stops
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 pt-4 border-t border-ink-900/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenTrip(t)}
                        className="bg-palm-600 hover:bg-palm-700 text-sand-50 font-body text-xs font-semibold px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View Trip
                      </button>
                      <button
                        onClick={() => handleModifyTrip(t)}
                        className="border border-ink-900/15 hover:border-palm-600 text-ink-900 hover:text-palm-700 font-body text-xs font-medium px-3 py-2 rounded-xl transition flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Modify
                      </button>
                    </div>

                    <button
                      onClick={() => handleDeleteTrip(t.id)}
                      className="text-ink-700/40 hover:text-rock-600 p-2 rounded-lg hover:bg-rock-600/10 transition"
                      title="Delete trip"
                      aria-label="Delete saved trip"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
