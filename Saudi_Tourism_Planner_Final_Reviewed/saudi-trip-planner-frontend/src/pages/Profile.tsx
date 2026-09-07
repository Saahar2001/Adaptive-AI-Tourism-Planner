import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthService } from "../lib/auth";
import { FavoritesService } from "../lib/favorites";
import type { UserProfile, TransportMode, FavoritePlace } from "../lib/types";
import { User, Mail, Compass, Car, CheckCircle2, Heart, Trash2, Edit3, Save, LogOut } from "lucide-react";

const INTEREST_OPTIONS = ["Culture & Heritage", "Food", "Nature", "Adventure", "Shopping", "Relaxation"];

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(AuthService.getCurrentUser());
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [interests, setInterests] = useState<string[]>(user?.preferredInterests || ["Culture & Heritage", "Food"]);
  const [transport, setTransport] = useState<TransportMode>(user?.preferredTransport || "driving");
  const [requireAccessibility, setRequireAccessibility] = useState(user?.requireAccessibility || false);
  const [favorites, setFavorites] = useState<FavoritePlace[]>(FavoritesService.getUserFavorites());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    function refresh() {
      const u = AuthService.getCurrentUser();
      setUser(u);
      if (u) {
        setName(u.name);
        setInterests(u.preferredInterests);
        setTransport(u.preferredTransport);
        setRequireAccessibility(u.requireAccessibility);
      }
      setFavorites(FavoritesService.getUserFavorites());
    }
    window.addEventListener("auth-changed", refresh);
    window.addEventListener("favorites-changed", refresh);
    return () => {
      window.removeEventListener("auth-changed", refresh);
      window.removeEventListener("favorites-changed", refresh);
    };
  }, []);

  function toggleInterest(opt: string) {
    setInterests((cur) => (cur.includes(opt) ? cur.filter((i) => i !== opt) : [...cur, opt]));
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      const updated = AuthService.updateProfile({
        name,
        preferredInterests: interests,
        preferredTransport: transport,
        requireAccessibility,
      });
      setUser(updated);
      setIsEditing(false);
      setSaveMessage("Profile preferences updated successfully.");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
    }
  }

  function handleRemoveFavorite(id: string) {
    FavoritesService.removeFavorite(id);
    setFavorites(FavoritesService.getUserFavorites());
  }

  return (
    <div className="min-h-screen bg-sand-100 py-10">
      <div className="max-w-content mx-auto px-6 space-y-10">
        {/* Header & User Info */}
        <div className="bg-white/80 border border-ink-900/10 rounded-3xl p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-palm-600 text-sand-50 flex items-center justify-center font-display text-2xl font-bold shadow-md">
                {user ? user.name[0]?.toUpperCase() : "G"}
              </div>
              <div>
                <h1 className="font-display text-2xl md:text-3xl text-ink-900">
                  {user ? user.name : "Guest Explorer"}
                </h1>
                <p className="font-body text-xs text-ink-700/70 mt-0.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {user ? user.email : "Local guest session (not signed in)"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 rounded-full border border-ink-900/15 hover:border-palm-600 font-body text-xs font-semibold text-ink-900 hover:text-palm-700 flex items-center gap-1.5 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Preferences
                    </button>
                  ) : null}
                  <button
                    onClick={() => {
                      AuthService.logout();
                      navigate("/");
                    }}
                    className="px-4 py-2 rounded-full border border-rock-600/30 text-rock-600 hover:bg-rock-600/10 font-body text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-4 py-2 rounded-full border border-ink-900/15 font-body text-xs font-medium text-ink-900 hover:border-palm-600"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="px-4 py-2 rounded-full bg-palm-600 text-sand-50 font-body text-xs font-medium hover:bg-palm-700 shadow-xs"
                  >
                    Create Account
                  </Link>
                </div>
              )}
            </div>
          </div>

          {saveMessage && (
            <div className="mt-4 p-3 rounded-xl bg-palm-50 border border-palm-600/20 text-palm-700 text-xs font-body flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saveMessage}</span>
            </div>
          )}

          {/* Preferences Form or Display */}
          {user && isEditing ? (
            <form onSubmit={handleSaveProfile} className="mt-8 pt-6 border-t border-ink-900/10 space-y-6">
              <div>
                <label className="block text-xs font-semibold text-ink-900 mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-sand-50/70 border border-ink-900/15 rounded-xl px-4 py-2 text-sm text-ink-900 w-full max-w-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-900 mb-2">Preferred Interests</label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((opt) => {
                    const active = interests.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleInterest(opt)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-body border transition-all ${
                          active
                            ? "bg-palm-600 border-palm-600 text-sand-50 font-medium"
                            : "bg-white border-ink-900/15 text-ink-700 hover:border-palm-600"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 max-w-lg">
                <div>
                  <label className="block text-xs font-semibold text-ink-900 mb-1.5">Preferred Transport</label>
                  <select
                    value={transport}
                    onChange={(e) => setTransport(e.target.value as TransportMode)}
                    className="bg-sand-50/70 border border-ink-900/15 rounded-xl px-3 py-2 text-xs text-ink-900 w-full"
                  >
                    <option value="driving">Driving / Taxi</option>
                    <option value="public_transit">Public Transit</option>
                    <option value="walking">Walking</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="edit-acc"
                    checked={requireAccessibility}
                    onChange={(e) => setRequireAccessibility(e.target.checked)}
                    className="rounded text-palm-600 focus:ring-palm-600 w-4 h-4"
                  />
                  <label htmlFor="edit-acc" className="text-xs text-ink-900 font-medium cursor-pointer">
                    Strict Accessibility Required
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="bg-palm-600 hover:bg-palm-700 text-sand-50 px-5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="border border-ink-900/15 px-4 py-2 rounded-xl text-xs text-ink-700 hover:bg-black/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : user ? (
            <div className="mt-8 pt-6 border-t border-ink-900/10 grid sm:grid-cols-3 gap-6 font-body text-xs">
              <div>
                <span className="text-ink-700/60 block mb-1">Interests</span>
                <span className="font-semibold text-ink-900 text-sm">
                  {user.preferredInterests.join(", ") || "None specified"}
                </span>
              </div>
              <div>
                <span className="text-ink-700/60 block mb-1">Preferred Transport</span>
                <span className="font-semibold text-ink-900 text-sm capitalize">
                  {user.preferredTransport.replace("_", " ")}
                </span>
              </div>
              <div>
                <span className="text-ink-700/60 block mb-1">Accessibility Preference</span>
                <span className="font-semibold text-ink-900 text-sm">
                  {user.requireAccessibility ? "Strict confirmation required" : "Standard mode"}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Favorite Places Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl text-ink-900 flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" /> Bookmarked Venues
              </h2>
              <p className="text-xs text-ink-700/70">
                Places you have saved across Saudi Arabia
              </p>
            </div>
            <span className="text-xs font-semibold bg-white border border-ink-900/10 px-3 py-1 rounded-full text-ink-700">
              {favorites.length} places
            </span>
          </div>

          {favorites.length === 0 ? (
            <div className="bg-white/60 border border-ink-900/10 rounded-2xl p-10 text-center text-ink-700/70 font-body">
              <Heart className="w-8 h-8 text-ink-700/30 mx-auto mb-2" />
              <p className="text-sm font-medium">No saved favorite places yet.</p>
              <p className="text-xs mt-1">
                Browse our recommended stops on the Results or Trending pages and click the heart icon to save them here.
              </p>
              <Link
                to="/plan"
                className="inline-block mt-4 bg-palm-600 text-sand-50 px-4 py-2 rounded-full text-xs font-semibold hover:bg-palm-700 transition"
              >
                Plan a Trip Now
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className="bg-white border border-ink-900/10 rounded-xl overflow-hidden shadow-xs hover:border-palm-600/40 transition flex flex-col justify-between"
                >
                  {fav.image_url ? (
                    <div className="h-32 w-full bg-sand-200/50 overflow-hidden">
                      <img src={fav.image_url} alt={fav.name} className="w-full h-full object-cover" />
                    </div>
                  ) : null}

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-ink-900 text-sm">{fav.name}</h3>
                        <button
                          onClick={() => handleRemoveFavorite(fav.id)}
                          className="text-ink-700/40 hover:text-red-500 p-1"
                          title="Remove bookmark"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-palm-700 capitalize mt-0.5">{fav.category} • {fav.city}</p>
                      {fav.address && (
                        <p className="text-[11px] text-ink-700/70 mt-1 line-clamp-2">{fav.address}</p>
                      )}
                    </div>

                    {typeof fav.estimated_cost === "number" && (
                      <div className="mt-3 pt-2 border-t border-ink-900/5 text-xs text-palm-700 font-semibold">
                        Est. {fav.estimated_cost} SAR
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
