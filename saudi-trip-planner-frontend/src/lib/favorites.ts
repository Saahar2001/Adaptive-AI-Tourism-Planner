import type { FavoritePlace, Place, PlaceCategory } from "./types";
import { AuthService } from "./auth";

const FAVORITES_KEY = "saudi_tourism_favorites";

export const FavoritesService = {
  getAllFavorites(): FavoritePlace[] {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  getUserFavorites(): FavoritePlace[] {
    const user = AuthService.getCurrentUser();
    const userId = user?.id || "guest";
    const all = this.getAllFavorites();
    return all.filter((f) => f.userId === userId).sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  },

  isFavorite(placeName: string, city?: string): boolean {
    const user = AuthService.getCurrentUser();
    const userId = user?.id || "guest";
    const all = this.getAllFavorites();
    const norm = placeName.trim().toLowerCase();
    return all.some(
      (f) =>
        f.userId === userId &&
        f.name.trim().toLowerCase() === norm &&
        (!city || f.city.trim().toLowerCase() === city.trim().toLowerCase())
    );
  },

  toggleFavorite(place: Place | {
    id?: string;
    name: string;
    city?: string;
    category?: PlaceCategory | string;
    estimated_cost?: number;
    address?: string;
    image_url?: string | null;
    latitude?: number;
    longitude?: number;
    source?: string;
  }): boolean {
    const user = AuthService.getCurrentUser();
    const userId = user?.id || "guest";
    const all = this.getAllFavorites();
    const normName = place.name.trim().toLowerCase();
    const existingIndex = all.findIndex(
      (f) => f.userId === userId && f.name.trim().toLowerCase() === normName
    );

    if (existingIndex !== -1) {
      all.splice(existingIndex, 1);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(all));
      window.dispatchEvent(new Event("favorites-changed"));
      return false; // Removed
    } else {
      const newFav: FavoritePlace = {
        id: (place as any).id || `fav_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId,
        name: place.name,
        city: (place as any).city || "Saudi Arabia",
        category: ((place.category as PlaceCategory) || "attractions"),
        estimated_cost: place.estimated_cost,
        address: place.address,
        image_url: place.image_url ?? null,
        latitude: place.latitude,
        longitude: place.longitude,
        source: place.source,
        savedAt: new Date().toISOString(),
      };
      all.unshift(newFav);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(all));
      window.dispatchEvent(new Event("favorites-changed"));
      return true; // Added
    }
  },

  removeFavorite(id: string): void {
    const all = this.getAllFavorites();
    const filtered = all.filter((f) => f.id !== id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("favorites-changed"));
  },
};
