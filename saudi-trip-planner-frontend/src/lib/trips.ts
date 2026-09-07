import type { SavedTrip, TripPreferences, TripResult } from "./types";
import { AuthService } from "./auth";

const TRIPS_STORAGE_KEY = "saudi_tourism_saved_trips";

export const TripStorageService = {
  getAllTrips(): SavedTrip[] {
    try {
      const raw = localStorage.getItem(TRIPS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  getUserTrips(): SavedTrip[] {
    const user = AuthService.getCurrentUser();
    const all = this.getAllTrips();
    const userId = user?.id || "guest";
    return all.filter((t) => t.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  saveTrip(prefs: TripPreferences, result: TripResult): SavedTrip | null {
    // Never save broken or empty trip responses as completed trips
    if (!result || !result.places || result.places.length === 0 || !result.itinerary || result.itinerary.length === 0) {
      return null;
    }

    const user = AuthService.getCurrentUser();
    const userId = user?.id || "guest";

    const all = this.getAllTrips();

    // Deduplicate recent identical trip save within 5 seconds
    const existingIdx = all.findIndex(
      (t) =>
        t.userId === userId &&
        t.prefs.city === prefs.city &&
        t.prefs.days === prefs.days &&
        t.prefs.budget === prefs.budget &&
        Math.abs(new Date(t.createdAt).getTime() - Date.now()) < 5000
    );

    const savedTrip: SavedTrip = {
      id: `trip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      createdAt: new Date().toISOString(),
      prefs,
      result,
    };

    if (existingIdx !== -1) {
      all[existingIdx] = savedTrip;
    } else {
      all.unshift(savedTrip);
    }

    try {
      localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(all));
      window.dispatchEvent(new Event("trips-changed"));
    } catch (e) {
      console.error("Failed to save trip to localStorage", e);
    }

    return savedTrip;
  },

  getTripById(id: string): SavedTrip | null {
    const all = this.getAllTrips();
    return all.find((t) => t.id === id) || null;
  },

  deleteTrip(id: string): boolean {
    const all = this.getAllTrips();
    const filtered = all.filter((t) => t.id !== id);
    try {
      localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(filtered));
      window.dispatchEvent(new Event("trips-changed"));
      return true;
    } catch {
      return false;
    }
  },
};
