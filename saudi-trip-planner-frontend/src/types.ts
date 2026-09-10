export type TransportMode = "walking" | "public_transit" | "driving";

export interface TripPreferences {
  city: string;
  budget: number;
  days: number;
  interests: string[];
  transport: TransportMode;
  requireAccessibility?: boolean;
  tripMonth?: number;
}

export type PlaceCategory = "attractions" | "restaurants" | "cafes";

export interface Place {
  name: string;
  category: PlaceCategory;
  latitude?: number;
  longitude?: number;
  estimated_cost?: number;
  cost_is_estimate?: boolean;
  recommendation_score?: number;
  preference_match?: number;
  place_quality?: number;
  regional_demand?: number;
  seasonality?: number;
  distance_fit?: number;
  budget_fit?: number;
  distance_km_center?: number;
  accessibility_status?: "yes" | "no" | "unknown" | string;
  address?: string;
  source?: string;
  source_retrieved_at_utc?: string;
  image_url?: string | null;
}

export interface ItineraryStop {
  place: string;
  category: PlaceCategory;
  latitude?: number;
  longitude?: number;
  estimated_cost?: number;
  cost_is_estimate?: boolean;
  visit_duration_hours?: number;
  travel_time_hours?: number;
  travel_distance_km?: number;
  travel_time_is_estimate?: boolean;
  route_method?: string;
  opening_hours_status?: string;
  accessibility_status?: string;
  source?: string;
  source_retrieved_at_utc?: string;
  image_url?: string | null;
}

export interface ItineraryDay {
  day: number;
  stops: ItineraryStop[];
}

export interface TripMetadata {
  trip_month?: number;
  engine?: string;
  route_method?: string;
  regional_context?: string;
  forecast_model_used_for_ranking?: boolean;
  recommendation_weights?: Record<string, number>;
  budget_constraint_status?: "binding" | "partially_binding" | "non_binding" | string;
  budget_estimate_basis?: string;
  costs_are_category_estimates?: boolean;
  estimated_places_capacity?: number;
  estimated_per_stop_allowance?: number;
  estimated_total_cost?: number;
  remaining_budget?: number;
  budget_utilization_pct?: number;
  [key: string]: unknown;
}

export interface TripResult {
  places: Place[];
  itinerary: ItineraryDay[];
  warnings?: string[];
  metadata?: TripMetadata;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  preferredInterests: string[];
  preferredTransport: TransportMode;
  requireAccessibility: boolean;
  createdAt: string;
}

export interface SavedTrip {
  id: string;
  userId: string;
  createdAt: string;
  prefs: TripPreferences;
  result: TripResult;
}

export interface FavoritePlace {
  id: string;
  userId: string;
  name: string;
  city: string;
  category: PlaceCategory;
  estimated_cost?: number;
  address?: string;
  image_url?: string | null;
  latitude?: number;
  longitude?: number;
  source?: string;
  savedAt: string;
}
