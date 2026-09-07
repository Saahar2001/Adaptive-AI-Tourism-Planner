"""
FastAPI wrapper around the ML engine (ml_engine.py). Exposes trip planning and dashboard endpoints.

Run with:  uvicorn main:app --reload --port 8000
"""

import math
import os
import re
import difflib
import urllib.parse

import pandas as pd
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal, Optional

try:
    import googlemaps
except ImportError:  # optional dependency - only needed if a real API key is set
    googlemaps = None

import ml_engine as eng

app = FastAPI(
    title="Saudi Tourism Planner API",
    version="2.0.0",
    description="Grounded hybrid recommendation and constraint-aware itinerary API.",
)

frontend_origins = [
    origin.strip()
    for origin in os.environ.get(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://localhost:3000",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Set base directories and data paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "tourism_app_data")
ML_ARTIFACTS_DIR = os.path.join(BASE_DIR, "ml_artifacts")

# Load datasets
places_df = pd.read_pickle(os.path.join(DATA_DIR, "places_df.pkl"))
features_df = pd.read_pickle(os.path.join(DATA_DIR, "features_df.pkl"))

# ------------------------------------------------------------
# Google Places photo lookup (optional -- only active with a real key)
# ------------------------------------------------------------
# Set a real key via the GOOGLE_PLACES_API_KEY env var to enable this path.
# Without it, get_exact_place_photo() falls back to the free Wikipedia
# lookup and, failing that, returns None (never a wrong/generic photo).
API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")
gmaps = googlemaps.Client(key=API_KEY) if (googlemaps and API_KEY) else None

_PHOTO_CACHE: dict = {}


def _google_places_photo(place_name: str, city: str):
    """Try to find a photo of this exact place via the Google Places API.
    Returns a URL string on success, or None (never guesses/substitutes)."""
    if not gmaps:
        return None
    try:
        find_result = gmaps.find_place(
            input=f"{place_name}, {city}, Saudi Arabia",
            input_type="textquery",
            fields=["photos"],
        )
        candidates = find_result.get("candidates", [])
        if candidates and "photos" in candidates[0]:
            photo_ref = candidates[0]["photos"][0]["photo_reference"]
            return f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference={photo_ref}&key={API_KEY}"
    except Exception as e:
        print(f"[photo] Google Places lookup failed for '{place_name}': {e}")
    return None


def _wikipedia_photo(place_name: str, city: str):
    """Free, keyless lookup of a specific place's thumbnail via the Wikipedia
    API. Only returns a photo when Wikipedia has a matching page -- never a
    generic/city-level substitute, since that would attach the wrong photo
    to the wrong place."""
    query = f"{place_name} {city}"
    try:
        url = (
            "https://en.wikipedia.org/w/api.php?action=query&titles="
            f"{urllib.parse.quote(query)}&prop=pageimages&format=json&pithumbsize=600"
        )
        res = requests.get(url, headers={"User-Agent": "SaudiTourismApp/1.0"}, timeout=5).json()
        pages = res.get("query", {}).get("pages", {})
        for page_id, page in pages.items():
            if page_id == "-1":  # Wikipedia's "no matching page" marker
                continue
            if "thumbnail" in page:
                return page["thumbnail"]["source"]
    except Exception as e:
        print(f"[photo] Wikipedia lookup failed for '{place_name}': {e}")
    return None


def get_exact_place_photo(place_name: str, city: str):
    """Single source of truth for place photos (the two duplicate
    definitions that used to exist here -- one Wikipedia-based, one
    Google-based, silently shadowing each other -- have been merged).

    Tries a real photo of this exact place (Google Places if a key is
    configured, then the free Wikipedia lookup). If neither finds a
    specific match, returns None rather than a generic stock photo --
    a wrong/repeated photo is worse than no photo for a "trending places"
    list, since it misrepresents the place.
    """
    if not place_name or place_name == "Unknown Place":
        return None

    cache_key = (place_name, city)
    if cache_key in _PHOTO_CACHE:
        return _PHOTO_CACHE[cache_key]

    photo = _google_places_photo(place_name, city) or _wikipedia_photo(place_name, city)
    _PHOTO_CACHE[cache_key] = photo
    return photo


TRANSPORT_MAP = {
    "walking": "Walking",
    "public_transit": "Public Transit",
    "driving": "Driving / Taxi",
}


class PlanTripRequest(BaseModel):
    city: str = Field(min_length=2, max_length=80)
    budget: float = Field(default=1000, gt=0, le=1_000_000)
    days: int = Field(default=3, ge=1, le=14)
    interests: list[str] = Field(default_factory=list, max_length=12)
    transport_mode: Literal["walking", "public_transit", "driving"] = "driving"
    require_accessibility: bool = False
    trip_month: Optional[int] = Field(default=None, ge=1, le=12)


class DemandForecastRequest(BaseModel):
    city: str = Field(min_length=2, max_length=80)


def _clean(value):
    """Replace NaN/inf with None so the response is valid JSON."""
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def _place_to_json(row) -> dict:
    return {
        "name": row.get("name"),
        "category": row.get("place_type"),
        "latitude": _clean(row.get("latitude")),
        "longitude": _clean(row.get("longitude")),
        "estimated_cost": _clean(row.get("estimated_cost")),
        "cost_is_estimate": bool(row.get("cost_is_estimate", True)),
        "recommendation_score": _clean(row.get("recommendation_score")),
        "preference_match": _clean(row.get("preference_match")),
        "regional_demand": _clean(row.get("regional_demand")),
        "seasonality": _clean(row.get("seasonality")),
        "distance_km_center": _clean(row.get("distance_km_center")),
        "accessibility_status": row.get("accessibility_status", "unknown"),
        "address": row.get("address"),
        "source": row.get("source", row.get("_source")),
        "source_retrieved_at_utc": row.get("source_retrieved_at_utc"),
    }


def _stop_to_json(row) -> dict:
    return {
        "day": int(row.get("day")),
        "place": row.get("place"),
        "category": row.get("place_type"),
        "latitude": _clean(row.get("latitude")),
        "longitude": _clean(row.get("longitude")),
        "estimated_cost": _clean(row.get("estimated_cost")),
        "cost_is_estimate": bool(row.get("cost_is_estimate", True)),
        "visit_duration_hours": _clean(row.get("visit_duration_hours")),
        "travel_time_hours": _clean(row.get("travel_time_hours")),
        "travel_distance_km": _clean(row.get("travel_distance_km")),
        "travel_time_is_estimate": bool(row.get("travel_time_is_estimate", True)),
        "route_method": row.get("route_method"),
        "opening_hours_status": row.get("opening_hours_status", "unknown"),
        "accessibility_status": row.get("accessibility_status", "unknown"),
        "source": row.get("source"),
        "source_retrieved_at_utc": row.get("source_retrieved_at_utc"),
    }


@app.post("/plan-trip")
def plan_trip(req: PlanTripRequest):
    if req.city not in eng.CITIES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported city. Choose one of: {list(eng.CITIES)}",
        )

    trip_month = req.trip_month or pd.Timestamp.now().month
    recommendations = eng.recommend_places(
        city=req.city,
        interests=req.interests,
        budget=req.budget,
        features_df=features_df,
        top_n=max(12, req.days * 4),
        require_accessibility=req.require_accessibility,
        trip_month=trip_month,
    )

    warnings = []
    if req.require_accessibility:
        warnings.append(
            "Strict accessibility mode only accepts venues with confirmed accessibility evidence; "
            "unknown accessibility is not treated as accessible."
        )

    if recommendations is None or recommendations.empty:
        warnings.append(
            "No grounded venues satisfied the current request and evidence constraints."
        )
        return {
            "places": [],
            "itinerary": [],
            "warnings": warnings,
            "metadata": {
                "trip_month": trip_month,
                "engine": "hybrid_context_ranker",
                "route_method": "haversine_x_road_factor",
            },
        }

    if bool(recommendations.get("cost_is_estimate", pd.Series([True])).all()):
        warnings.append(
            "Venue-level prices are unavailable from the current Places API; displayed costs are category-level estimates."
        )

    itinerary = eng.generate_itinerary(
        recommendations=recommendations,
        budget=req.budget,
        days=req.days,
        hours_per_day=8,
        city=req.city,
        require_accessibility=req.require_accessibility,
        transport_mode=TRANSPORT_MAP[req.transport_mode],
    )

    if itinerary is None or itinerary.empty:
        warnings.append(
            "Recommendations were found, but no stops could be scheduled under the current budget/time/evidence constraints."
        )

    artifacts = eng._load_ml_artifacts()
    metadata = artifacts.get("metadata", {}) if artifacts else {}
    return {
        "places": [_place_to_json(r) for _, r in recommendations.iterrows()],
        "itinerary": [_stop_to_json(r) for _, r in itinerary.iterrows()] if itinerary is not None and not itinerary.empty else [],
        "warnings": warnings,
        "metadata": {
            "trip_month": trip_month,
            "engine": "hybrid_context_ranker",
            "model_version": metadata.get("model_version"),
            "forecast_model_used_for_ranking": False,
            "regional_context": "KAPSARC city-total + national tourism-sector signals",
            "seasonality_context": "DataSaudi province/month occupancy",
            "route_method": "haversine_x_road_factor",
        },
    }


@app.post("/predict-demand")
def predict_demand(req: DemandForecastRequest):
    if req.city not in eng.CITIES:
        raise HTTPException(status_code=422, detail=f"Unsupported city. Choose one of: {list(eng.CITIES)}")
    forecast = eng.predict_next_month_city_demand(req.city)
    if forecast is None:
        raise HTTPException(
            status_code=422,
            detail="A trained one-month city-demand forecast is not available for this city.",
        )
    return forecast


# ------------------------------------------------------------
# Trending places: filtering + scoring
# ------------------------------------------------------------
# places_df comes straight from raw OpenStreetMap/Geoapify data (see
# tourism_app_data/places_df.pkl) and includes a lot of geocoder noise:
# "Unknown Place" (the geocoder's own placeholder for "no name found"),
# generic businesses ("work", "hotel", shops, offices, delivery points,
# personal names picked up as POIs), and restaurants/cafes that aren't
# really "trending destinations" in the sightseeing sense. There is no
# per-place "rating" in this dataset -- popularity_score is a constant
# repeated for every row sharing the same (city, place_type), so it
# cannot stand in for an individual place's rating (verified: it's the
# exact same number across e.g. all 208 Dammam restaurants).
#
# Only place_type == "attraction" rows are considered here; restaurants
# and cafes are excluded from "trending destinations" per product intent
# (a generic cafe isn't a tourist destination), not because the data is
# bad for them specifically.

_JUNK_NAME_PATTERNS = [
    r"^\s*unknown place\s*$",
    r"^\s*work\s*$",
    r"^\s*n/?a\s*$",
    r"\bhotel\b",
    r"\bhr\b",
    r"\btrading\b",
    r"\bworkshop\b",
    r"\boffice\b",
    r"\bshop\b",
    r"شركة",
    r"مؤسسة",
    r"مكتب",
    r"صالون",
    r"معرض",
    r"تسليم",
    r"سفريات",
    r"مطابع",
]
_JUNK_NAME_REGEX = re.compile("|".join(_JUNK_NAME_PATTERNS), re.IGNORECASE)

# A place only counts as a genuine "trending destination" if its name
# contains a recognizable landmark/place-type word. This is a precision-
# first filter: it will miss a few legitimate but generically-named spots
# (accepted trade-off), but it reliably keeps out personal/business names
# that happen to dodge the blacklist above (e.g. "Malik", "Jaffar bhai",
# "VRMates", "BAZY DAMMAM" -- all real values found in this dataset).
_LANDMARK_KEYWORDS = [
    # Arabic
    "قصر", "قلعة", "متحف", "حديقة", "كورنيش", "كرنيش", "واجهة", "جبل", "وادي",
    "ميدان", "سوق", "برج", "مسجد", "قرية", "شاطئ", "منتزه", "مطل", "درب",
    "ممشى", "تراث", "أثري", "أثرية", "تاريخي", "تاريخية", "آثار",
    # English
    "souq", "souk", "palace", "fort", "castle", "museum", "park", "corniche",
    "walkway", "village", "district", "theater", "theatre", "art", "mural",
    "gallery", "statue", "sculpture", "viewpoint", "beach", "garden",
    "square", "tower", "historic", "heritage", "trail", "promenade",
    "plaza", "mosque", "valley", "mountain", "cave", "waterfall", "lake",
    "oasis",
]
_LANDMARK_REGEX = re.compile("|".join(re.escape(k) for k in _LANDMARK_KEYWORDS), re.IGNORECASE)

_DEDUPE_STRIP_REGEX = re.compile(r"\b(entrance|gate|مدخل|بوابة)\b", re.IGNORECASE)
_DEDUPE_PUNCT_REGEX = re.compile(r"[^\w\s]", re.UNICODE)


def _is_valid_attraction_name(name: str) -> bool:
    if not isinstance(name, str) or not name.strip():
        return False
    if _JUNK_NAME_REGEX.search(name):
        return False
    return bool(_LANDMARK_REGEX.search(name))


def _normalize_for_dedupe(name: str, city: str) -> str:
    n = _DEDUPE_STRIP_REGEX.sub(" ", name.lower())
    n = _DEDUPE_PUNCT_REGEX.sub(" ", n)
    n = re.sub(r"\s+", " ", n).strip()
    if isinstance(city, str):
        n = n.replace(city.lower(), "").strip()
    return n


def _dedupe_attractions(rows: list) -> list:
    """Drops near-duplicate entries referring to the same real place
    (e.g. 'Dammam Souq' / 'Entrance Dammam Souq', or 'وادي حنيفة' /
    'وادي خنيفه' -- two spellings of the same valley found in the raw
    data). Keeps the first occurrence of each group."""
    kept, kept_keys = [], []
    for row in rows:
        key = _normalize_for_dedupe(row["name"], row["city"])
        is_dup = any(
            key == k or key in k or k in key or difflib.SequenceMatcher(None, key, k).ratio() >= 0.72
            for k in kept_keys
        )
        if not is_dup:
            kept.append(row)
            kept_keys.append(key)
    return kept


def _landmark_keyword_hits(name: str) -> int:
    return len(_LANDMARK_REGEX.findall(name))


def _compute_trending_score(row) -> float:
    """Composite, explainable score built only from real per-row fields
    (distance_score and cost_score genuinely vary row by row; the raw
    popularity_score does not -- see note above -- so it is intentionally
    left out rather than used as if it were an individual rating)."""
    distance_score = _clean(row.get("distance_score")) or 0.0
    cost_score = _clean(row.get("cost_score")) or 0.0
    keyword_bonus = min(1.0, _landmark_keyword_hits(row.get("name", "")) / 2.0)
    composite = (0.5 * distance_score) + (0.2 * cost_score) + (0.3 * keyword_bonus)
    return max(0.0, min(1.0, composite))


@app.get("/api/dashboard/trending-places")
def get_trending_places():
    try:
        attractions = places_df[places_df["place_type"] == "attraction"].copy()
        attractions = attractions[attractions["name"].apply(_is_valid_attraction_name)]

        if attractions.empty:
            return {"status": "success", "trending_places": []}

        attractions["trending_score"] = attractions.apply(_compute_trending_score, axis=1)

        # Bucket by city, best-scored first, then interleave (round-robin)
        # across cities so a single city with more raw data can't crowd
        # out the others. Cities with no qualifying places (e.g. Tabuk,
        # where almost every "attraction" row is either "Unknown Place"
        # or a generic hotel -- there is no clean local fallback for it)
        # are simply absent rather than padded with low-quality rows.
        per_city_rows = {
            city: _dedupe_attractions(
                g.sort_values("trending_score", ascending=False).to_dict("records")
            )
            for city, g in attractions.groupby("city")
        }
        for rows in per_city_rows.values():
            rows.sort(key=lambda r: r["trending_score"], reverse=True)

        ordered, cursors = [], {city: 0 for city in per_city_rows}
        cities_cycle = list(per_city_rows.keys())
        while len(ordered) < 9 and any(cursors[c] < len(per_city_rows[c]) for c in cities_cycle):
            for city in cities_cycle:
                if cursors[city] < len(per_city_rows[city]):
                    ordered.append(per_city_rows[city][cursors[city]])
                    cursors[city] += 1
                    if len(ordered) >= 9:
                        break

        records = []
        for row in ordered:
            place_name = str(row.get("name"))
            city = str(row.get("city"))

            image_url = row.get("image_url")
            if not isinstance(image_url, str) or not image_url.strip():
                image_url = get_exact_place_photo(place_name, city)

            records.append({
                "id": str(row.get("place_id", place_name)),
                "name": place_name,
                "city": city,
                "category": str(row.get("place_type", "Attraction")),
                "trend_score": round(float(row.get("trending_score", 0.0)), 3),
                "score_basis": "distance, category-level affordability estimate, and landmark-name relevance; not a visitor rating",
                "image_url": image_url,
            })

        return {"status": "success", "trending_places": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    artifacts = eng._load_ml_artifacts()
    return {
        "status": "ok",
        "service": "Saudi Tourism Planner API",
        "version": "2.0.0",
        "cities": list(eng.CITIES),
        "recommendation_context_loaded": bool(artifacts),
        "forecast_model_loaded": eng.forecast_model_available(),
    }


@app.get("/model-info")
def model_info():
    artifacts = eng._load_ml_artifacts()
    if not artifacts:
        return {
            "recommendation_context": {"available": False},
            "forecast_model": {"available": False},
            "limitations": ["ML context artifacts are not loaded; local fallback may be used."],
        }
    metadata = artifacts.get("metadata", {})
    forecast_meta = metadata.get("forecast_model", {})
    metrics = artifacts.get("forecast_metrics") or {}
    return {
        "model_version": metadata.get("model_version"),
        "recommendation_context": {
            "available": True,
            **metadata.get("recommendation_context", {}),
        },
        "forecast_model": {
            "available": artifacts.get("forecast_model") is not None,
            **forecast_meta,
            "evaluation": metrics.get("final_holdout"),
        },
        "kapsarc_granularity": metadata.get("kapsarc_granularity"),
        "limitations": metadata.get("limitations", []),
    }

