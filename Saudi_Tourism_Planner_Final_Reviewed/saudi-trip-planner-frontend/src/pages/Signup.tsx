import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthService } from "../lib/auth";
import { Lock, Mail, User, AlertCircle } from "lucide-react";
import type { TransportMode } from "../lib/types";

const INTEREST_OPTIONS = ["Culture & Heritage", "Food", "Nature", "Adventure", "Shopping", "Relaxation"];

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [interests, setInterests] = useState<string[]>(["Culture & Heritage", "Food"]);
  const [transport, setTransport] = useState<TransportMode>("driving");
  const [requireAccessibility, setRequireAccessibility] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleInterest(opt: string) {
    setInterests((cur) => (cur.includes(opt) ? cur.filter((i) => i !== opt) : [...cur, opt]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      AuthService.signUp({
        name,
        email,
        password,
        preferredInterests: interests,
        preferredTransport: transport,
        requireAccessibility,
      });
      navigate("/profile");
    } catch (err: any) {
      setError(err?.message || "Failed to create account.");
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-sand-100 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg bg-white/80 backdrop-blur-sm border border-ink-900/10 rounded-2xl p-8 shadow-sm">
        <div className="text-center mb-8">
          <span className="text-3xl" role="img" aria-label="Passport">🛂</span>
          <h1 className="font-display text-2xl font-semibold text-ink-900 mt-2">
            Create Explorer Account
          </h1>
          <p className="font-body text-xs text-ink-700/70 mt-1">
            Personalize your AI itinerary generation and keep your travel history across devices.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rock-600/10 border border-rock-600/20 text-rock-600 text-xs font-body flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-body text-sm">
          <div>
            <label className="block text-xs font-medium text-ink-900 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-ink-700/40 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nouf Al-Otaibi"
                className="w-full bg-sand-50/60 border border-ink-900/15 rounded-xl pl-10 pr-4 py-2.5 text-ink-900 focus:outline-none focus:border-palm-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-900 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-700/40 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nouf@example.sa"
                className="w-full bg-sand-50/60 border border-ink-900/15 rounded-xl pl-10 pr-4 py-2.5 text-ink-900 focus:outline-none focus:border-palm-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-900 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-700/40 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className="w-full bg-sand-50/60 border border-ink-900/15 rounded-xl pl-10 pr-4 py-2.5 text-ink-900 focus:outline-none focus:border-palm-600"
              />
            </div>
          </div>

          {/* Travel Preferences */}
          <div className="pt-2">
            <label className="block text-xs font-medium text-ink-900 mb-1.5">
              Default Travel Interests
            </label>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_OPTIONS.map((opt) => {
                const active = interests.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleInterest(opt)}
                    className={`px-3 py-1 rounded-full text-xs font-body border transition-all ${
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

          <div className="pt-2 flex items-center justify-between gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-900 mb-0.5">
                Preferred Transport
              </label>
              <select
                value={transport}
                onChange={(e) => setTransport(e.target.value as TransportMode)}
                className="bg-sand-50/60 border border-ink-900/15 rounded-xl px-3 py-1.5 text-xs text-ink-900 focus:outline-none"
              >
                <option value="driving">Driving / Taxi</option>
                <option value="public_transit">Public Transit</option>
                <option value="walking">Walking</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="acc-check"
                checked={requireAccessibility}
                onChange={(e) => setRequireAccessibility(e.target.checked)}
                className="rounded text-palm-600 focus:ring-palm-600 w-4 h-4"
              />
              <label htmlFor="acc-check" className="text-xs text-ink-700 cursor-pointer">
                Strict accessibility
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-4 bg-palm-600 hover:bg-palm-700 text-sand-50 font-medium py-3 rounded-xl transition shadow-xs"
          >
            Create Account
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-700 font-body">
          Already have an account?{" "}
          <Link to="/login" className="text-palm-700 font-semibold hover:underline">
            Sign In here
          </Link>
        </p>
      </div>
    </div>
  );
}
