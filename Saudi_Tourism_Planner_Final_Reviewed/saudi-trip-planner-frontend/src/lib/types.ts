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
  regional_demand?: number;
  seasonality?: number;
  distance_km_center?: number;
  accessibility_status?: "yes" | "no" | "unknown" | string;
  address?: string;
  source?: string;
  source_retrieved_at_utc?: string;
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
  [key: string]: unknown;
}

export interface TripResult {
  places: Place[];
  itinerary: ItineraryDay[];
  warnings?: string[];
  metadata?: TripMetadata;
}
