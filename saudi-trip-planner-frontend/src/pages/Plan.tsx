import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTrip } from "../lib/TripContext";
import { generateTrip, ApiError } from "../lib/api";
import type { TransportMode } from "../lib/types";

const CITIES = ["Riyadh", "Jeddah", "Makkah", "Madinah", "AlUla", "Abha", "Dammam", "Tabuk"];
const INTEREST_OPTIONS = ["Culture & Heritage", "Food", "Nature", "Adventure", "Shopping", "Relaxation"];
const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TRANSPORT_OPTIONS: { value: TransportMode; label: string }[] = [
  { value: "walking", label: "🚶 Walking" },
  { value: "public_transit", label: "🚌 Public transit" },
  { value: "driving", label: "🚗 Driving / taxi" },
];

import { AuthService } from "../lib/auth";
import { TripStorageService } from "../lib/trips";

export default function Plan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { prefs, setPrefs, setResult } = useTrip();

  const user = AuthService.getCurrentUser();

  const cityParam = searchParams.get("city");
  const matchedCity = CITIES.find((c) => c.toLowerCase() === cityParam?.toLowerCase());
  const [city, setCity] = useState(matchedCity ?? prefs?.city ?? CITIES[0]);
  const [budget, setBudget] = useState(prefs?.budget ?? 1000);
  const [days, setDays] = useState(prefs?.days ?? 3);
  const [interests, setInterests] = useState<string[]>(
    prefs?.interests ?? user?.preferredInterests ?? ["Culture & Heritage", "Food"]
  );
  const [transport, setTransport] = useState<TransportMode>(
    prefs?.transport ?? user?.preferredTransport ?? "driving"
  );
  const [requireAccessibility, setRequireAccessibility] = useState(
    prefs?.requireAccessibility ?? user?.requireAccessibility ?? false
  );
  const [tripMonth, setTripMonth] = useState(prefs?.tripMonth ?? new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleInterest(name: string) {
    setInterests((cur) => (cur.includes(name) ? cur.filter((i) => i !== name) : [...cur, name]));
  }

  async function handleGenerate() {
    setError(null);
    if (!Number.isFinite(budget) || budget <= 0) {
      setError("Budget must be greater than 0 SAR.");
      return;
    }
    if (!Number.isInteger(days) || days < 1 || days > 14) {
      setError("Trip length must be between 1 and 14 days.");
      return;
    }
    setLoading(true);
    const newPrefs = { city, budget, days, interests, transport, requireAccessibility, tripMonth };
    setPrefs(newPrefs);
    try {
      const result = await generateTrip(newPrefs);
      setResult(result);
      TripStorageService.saveTrip(newPrefs, result);
      navigate("/results");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reach the trip planner backend. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-sand-100">
      <main className="max-w-content mx-auto px-6 py-10 md:py-12 grid md:grid-cols-[1fr_360px] gap-10">
        <div>
          <h1 className="font-display text-3xl text-ink-900 mb-8">Trip preferences</h1>

          <div className="space-y-8">
            <div>
              <label className="block font-body font-medium text-ink-900 mb-2">📍 Destination</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full border border-ink-900/15 rounded-lg px-4 py-3 bg-white font-body"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block font-body font-medium text-ink-900 mb-1">💰 Maximum Activity Budget (SAR)</label>
                <p className="text-[11px] text-ink-700/65 font-body mb-2 leading-tight">
                  Covers planned venues, dining & cafés. Accommodation, shopping, and transport fares not included.
                </p>
                <input
                  type="number"
                  min={1}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full border border-ink-900/15 rounded-lg px-4 py-3 bg-white font-body"
                />
              </div>
              <div>
                <label className="block font-body font-medium text-ink-900 mb-2">📅 Days</label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full border border-ink-900/15 rounded-lg px-4 py-3 bg-white font-body"
                />
              </div>
            </div>

            <div>
              <label className="block font-body font-medium text-ink-900 mb-2">🗓️ Travel month</label>
              <select
                value={tripMonth}
                onChange={(e) => setTripMonth(Number(e.target.value))}
                className="w-full border border-ink-900/15 rounded-lg px-4 py-3 bg-white font-body"
              >
                {MONTH_OPTIONS.map((month, index) => (
                  <option key={month} value={index + 1}>{month}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-body font-medium text-ink-900 mb-2">❤️ Interests</label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((opt) => {
                  const active = interests.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleInterest(opt)}
                      className={`px-4 py-2 rounded-full text-sm font-body border transition-colors ${
                        active
                          ? "bg-palm-600 border-palm-600 text-sand-50"
                          : "bg-white border-ink-900/15 text-ink-700 hover:border-palm-600"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-body font-medium text-ink-900 mb-2">🚗 Transport</label>
              <div className="flex gap-2">
                {TRANSPORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTransport(opt.value)}
                    className={`px-4 py-2 rounded-full text-sm font-body border transition-colors ${
                      transport === opt.value
                        ? "bg-palm-600 border-palm-600 text-sand-50"
                        : "bg-white border-ink-900/15 text-ink-700 hover:border-palm-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-body font-medium text-ink-900 mb-2">♿ Accessibility</label>
              <button
                type="button"
                onClick={() => setRequireAccessibility((value) => !value)}
                aria-pressed={requireAccessibility}
                className={`px-4 py-2 rounded-full text-sm font-body border transition-colors ${
                  requireAccessibility
                    ? "bg-palm-600 border-palm-600 text-sand-50"
                    : "bg-white border-ink-900/15 text-ink-700 hover:border-palm-600"
                }`}
              >
                {requireAccessibility ? "✓ Confirmed accessibility required" : "Require confirmed accessibility"}
              </button>
              <p className="mt-2 text-xs font-body text-ink-700/60">
                When enabled, places with unknown accessibility are not treated as accessible.
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-6 text-rock-600 font-body text-sm">{error}</p>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-10 bg-palm-600 hover:bg-palm-700 disabled:opacity-60 text-sand-50 font-body font-medium px-7 py-3.5 rounded-full transition-colors"
          >
            {loading ? "Generating…" : "🤖 Generate Trip"}
          </button>
        </div>

        <aside className="bg-palm-50 rounded-2xl p-6 h-fit">
          <p className="font-display text-lg text-ink-900 mb-3">Trip brief</p>
          <dl className="space-y-2 font-body text-sm text-ink-700">
            <div className="flex justify-between"><dt>Destination</dt><dd className="font-medium text-ink-900">{city}</dd></div>
            <div className="flex justify-between"><dt>Budget</dt><dd className="font-medium text-ink-900">{budget} SAR</dd></div>
            <div className="flex justify-between"><dt>Days</dt><dd className="font-medium text-ink-900">{days}</dd></div>
            <div className="flex justify-between"><dt>Travel month</dt><dd className="font-medium text-ink-900">{MONTH_OPTIONS[tripMonth - 1]}</dd></div>
            <div className="flex justify-between"><dt>Interests</dt><dd className="font-medium text-ink-900 text-right">{interests.length ? interests.join(", ") : "Any"}</dd></div>
            <div className="flex justify-between"><dt>Accessibility</dt><dd className="font-medium text-ink-900">{requireAccessibility ? "Required" : "No strict filter"}</dd></div>
          </dl>
        </aside>
      </main>
    </div>
  );
}
