import type { TripPreferences, TripResult, Place, ItineraryDay, ItineraryStop, PlaceCategory } from "./types";

// Point this at the FastAPI backend. Set VITE_API_BASE in a .env file
// (see .env.example). The localhost fallback is intentionally development-only.
export const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");
export const REQUEST_TIMEOUT_MS = 30_000;

function normalizeCategory(raw: string | undefined): PlaceCategory {
  const v = (raw || "").toLowerCase();
  if (v.startsWith("restaurant")) return "restaurants";
  if (v.startsWith("cafe")) return "cafes";
  return "attractions";
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizePlace(raw: any): Place {
  return {
    name: raw.name ?? raw.place ?? "Unnamed place",
    category: normalizeCategory(raw.category ?? raw.place_type),
    latitude: optionalNumber(raw.latitude ?? raw.lat),
    longitude: optionalNumber(raw.longitude ?? raw.lon ?? raw.lng),
    estimated_cost: optionalNumber(raw.estimated_cost ?? raw.cost),
    cost_is_estimate: raw.cost_is_estimate ?? true,
    recommendation_score: optionalNumber(raw.recommendation_score),
    preference_match: optionalNumber(raw.preference_match),
    regional_demand: optionalNumber(raw.regional_demand),
    seasonality: optionalNumber(raw.seasonality),
    distance_km_center: optionalNumber(raw.distance_km_center),
    accessibility_status: raw.accessibility_status ?? "unknown",
    address: raw.address,
    source: raw.source,
    source_retrieved_at_utc: raw.source_retrieved_at_utc,
    image_url: typeof raw.image_url === "string" && raw.image_url.trim() ? raw.image_url : null,
  };
}

function normalizeStop(raw: any): ItineraryStop {
  return {
    place: raw.place ?? raw.name ?? "Unnamed place",
    category: normalizeCategory(raw.category ?? raw.place_type),
    latitude: optionalNumber(raw.latitude ?? raw.lat),
    longitude: optionalNumber(raw.longitude ?? raw.lon ?? raw.lng),
    estimated_cost: optionalNumber(raw.estimated_cost),
    cost_is_estimate: raw.cost_is_estimate ?? true,
    visit_duration_hours: optionalNumber(raw.visit_duration_hours),
    travel_time_hours: optionalNumber(raw.travel_time_hours),
    travel_distance_km: optionalNumber(raw.travel_distance_km),
    travel_time_is_estimate: raw.travel_time_is_estimate ?? true,
    route_method: raw.route_method,
    opening_hours_status: raw.opening_hours_status,
    accessibility_status: raw.accessibility_status,
    source: raw.source,
    source_retrieved_at_utc: raw.source_retrieved_at_utc,
    image_url: typeof raw.image_url === "string" && raw.image_url.trim() ? raw.image_url : null,
  };
}

function normalizeItinerary(raw: any[]): ItineraryDay[] {
  if (!Array.isArray(raw)) return [];

  // Handles either an already-grouped [{day, stops:[...]}] shape or the
  // backend's flat list where each stop carries its own `day` field.
  if (raw.length > 0 && Array.isArray(raw[0]?.stops)) {
    return raw.map((d) => ({
      day: Number(d.day) || 1,
      stops: d.stops.map(normalizeStop),
    }));
  }

  const byDay = new Map<number, ItineraryDay>();
  for (const row of raw) {
    const day = Number(row.day) || 1;
    if (!byDay.has(day)) byDay.set(day, { day, stops: [] });
    byDay.get(day)!.stops.push(normalizeStop(row));
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length) {
      return detail
        .map((item) => item?.msg)
        .filter(Boolean)
        .join("; ") || `Request failed (${res.status})`;
    }
  } catch {
    // Fall through to a stable non-JSON message.
  }
  return `Request failed (${res.status})`;
}

export async function generateTrip(prefs: TripPreferences): Promise<TripResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/plan-trip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        city: prefs.city,
        budget: prefs.budget,
        days: prefs.days,
        interests: prefs.interests,
        transport_mode: prefs.transport,
        require_accessibility: prefs.requireAccessibility ?? false,
        trip_month: prefs.tripMonth,
      }),
    });

    if (!res.ok) {
      throw new ApiError(await errorMessage(res), res.status);
    }

    const data = await res.json();
    const rawPlaces = data.places ?? data.recommendations ?? [];
    const rawItinerary = data.itinerary ?? [];

    return {
      places: Array.isArray(rawPlaces) ? rawPlaces.map(normalizePlace) : [],
      itinerary: normalizeItinerary(rawItinerary),
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      metadata: data.metadata ?? undefined,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("The trip request timed out. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export interface AssistantChatResponse {
  response: string;
  source: string;
  model: string;
  intent?: string;
}

export async function sendAssistantMessage(
  message: string,
  history: { role: string; content: string }[],
  page: string,
  tripContext?: any
): Promise<AssistantChatResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(`${API_BASE}/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        message,
        history,
        page,
        trip_context: tripContext || {},
      }),
    });

    if (!res.ok) {
      throw new ApiError(await errorMessage(res), res.status);
    }

    return await res.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("The assistant took too long to reply. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function getTrendingPlaces(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/dashboard/trending-places`);
  if (!res.ok) {
    throw new ApiError(`Failed to load trending destinations (${res.status})`, res.status);
  }
  const data = await res.json();
  return Array.isArray(data.trending_places) ? data.trending_places : [];
}
