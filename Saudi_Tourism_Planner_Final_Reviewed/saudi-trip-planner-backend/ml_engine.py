
import pandas as pd
import numpy as np
import html
import json


# ============================================================
# BACKEND (merged from tourism_backend.py + Samsung ML engine)
# ============================================================


import re
import math
import time
import difflib
import threading
from pathlib import Path

import requests
import os

try:
    import joblib
except ImportError:
    joblib = None

# ------------------------------------------------------------
# Lightweight cache shim (replaces st.cache_resource / st.cache_data)
# ------------------------------------------------------------
# This module used to depend on Streamlit purely for its @st.cache_resource
# / @st.cache_data decorators (see the backend README: "streamlit is a
# dependency only because ml_engine.py reuses its caching decorators -- it
# never launches a Streamlit server here"). Running a FastAPI backend, we
# don't need the rest of Streamlit just for that, so these two small
# decorators reproduce the same behavior (in-process memoization, optional
# TTL) without the extra dependency. Behavior preserved:
#   - cache_resource: memoize forever (per process), same as st.cache_resource.
#   - cache_data(ttl=...): memoize per-args, expire after ttl seconds.
def cache_resource(func=None, *, show_spinner=False):
    def decorator(f):
        lock = threading.Lock()
        sentinel = object()
        cached = {"value": sentinel}

        def wrapper(*args, **kwargs):
            if cached["value"] is sentinel:
                with lock:
                    if cached["value"] is sentinel:
                        cached["value"] = f(*args, **kwargs)
            return cached["value"]

        wrapper.__wrapped__ = f
        return wrapper

    return decorator(func) if func is not None else decorator


def cache_data(func=None, *, ttl=None, show_spinner=False):
    def decorator(f):
        lock = threading.Lock()
        store = {}

        def wrapper(*args, **kwargs):
            key = (args, tuple(sorted(kwargs.items())))
            now = time.monotonic()
            with lock:
                entry = store.get(key)
                if entry is not None:
                    value, expires_at = entry
                    if expires_at is None or now < expires_at:
                        return value
                value = f(*args, **kwargs)
                expires_at = (now + ttl) if ttl else None
                store[key] = (value, expires_at)
                return value

        wrapper.__wrapped__ = f
        return wrapper

    return decorator(func) if func is not None else decorator


# ============================================================
# CONFIG
# ============================================================

ARTIFACT_ROOT = Path(__file__).resolve().parent / "ml_artifacts"
PLACES_API_BASE = os.environ.get("PLACES_API_BASE", "https://placesproject.onrender.com").rstrip("/")
HTTP_TIMEOUT_SECONDS = float(os.environ.get("HTTP_TIMEOUT_SECONDS", "5.0"))
CACHE_TTL_SECONDS = int(os.environ.get("CACHE_TTL_SECONDS", "900"))

CITIES = {
    "Riyadh": "Riyadh, Saudi Arabia",
    "Abha": "Abha, Saudi Arabia",
    "Dammam": "Dammam, Saudi Arabia",
    "Tabuk": "Tabuk, Saudi Arabia",
    "Jeddah": "Jeddah, Saudi Arabia",
    "Makkah": "Makkah, Saudi Arabia",
    "Madinah": "Madinah, Saudi Arabia",
    "AlUla": "AlUla, Saudi Arabia",
}

LOCAL_DATA_CITIES = set(CITIES.keys())

# Grounded ranking weights. Budget and accessibility are constraints/evidence gates,
# not ranking signals when venue-level evidence is unavailable.
RANK_WEIGHTS = {
    "preference_match": 0.45,
    "place_quality": 0.10,
    "regional_demand": 0.15,
    "seasonality": 0.10,
    "distance_fit": 0.20,
}

CITY_TO_PROVINCE = {
    "riyadh": "riyadh", "jeddah": "makkah", "makkah": "makkah", "mecca": "makkah",
    "madinah": "al madinah", "medina": "al madinah", "abha": "aseer",
    "alula": "al madinah", "al ula": "al madinah", "dammam": "eastern region",
    "khobar": "eastern province", "al khobar": "eastern province", "taif": "makkah",
    "tabuk": "tabouk", "hail": "hail", "jazan": "jazan", "najran": "najran",
    "buraydah": "al qassim", "buraidah": "al qassim",
}

CITY_CENTERS = {
    "Riyadh": (24.7136, 46.6753),
    "Abha": (18.2164, 42.5053),
    "Dammam": (26.4207, 50.0888),
    "Tabuk": (28.3838, 36.5550),
    "Jeddah": (21.4858, 39.1925),
    "Makkah": (21.3891, 39.8579),
    "Madinah": (24.5247, 39.5692),
    "AlUla": (26.6084, 37.9214),
}

ASSUMED_TRAVEL_SPEED_KMH = 30.0
ROUTE_DISTANCE_FACTOR = 1.3
TRANSPORT_SPEED_KMH = {
    "Walking": 4.5,
    "Public Transit": 22.0,
    "Driving / Taxi": ASSUMED_TRAVEL_SPEED_KMH,
}

# UI/product interests -> retrieval categories currently supported by the team Places API.
INTEREST_CATEGORY_MAP = {
    "food": ("restaurants", "cafes"),
    "culture & heritage": ("attractions",),
    "culture": ("attractions",),
    "heritage": ("attractions",),
    "nature": ("attractions",),
    "adventure": ("attractions",),
    "shopping": ("attractions",),
    "relaxation": ("attractions", "cafes"),
    # API-native labels are accepted too.
    "attractions": ("attractions",),
    "restaurants": ("restaurants",),
    "cafes": ("cafes",),
}
SUPPORTED_PLACE_CATEGORIES = ("attractions", "restaurants", "cafes")

INTEREST_KEYWORDS = {
    "culture & heritage": (
        "museum", "heritage", "historic", "historical", "castle", "fort", "palace",
        "mosque", "souq", "souk", "old town", "archae", "متحف", "تراث", "تاريخ",
        "قلعة", "قصر", "مسجد", "سوق", "أثري", "اثري",
    ),
    "nature": (
        "park", "garden", "valley", "mountain", "beach", "corniche", "oasis",
        "waterfall", "lake", "viewpoint", "حديقة", "وادي", "جبل", "شاطئ",
        "كورنيش", "واحة", "شلال", "بحيرة", "مطل",
    ),
    "adventure": (
        "trail", "hiking", "mountain", "cave", "climb", "adventure", "zipline",
        "درب", "مسار", "جبل", "كهف", "مغامر",
    ),
    "shopping": (
        "souq", "souk", "market", "mall", "bazaar", "shopping", "سوق", "مول",
        "مجمع", "بازار",
    ),
    "relaxation": (
        "park", "garden", "corniche", "beach", "promenade", "cafe", "حديقة",
        "كورنيش", "شاطئ", "ممشى", "مقهى",
    ),
}

CATEGORY_COST_ESTIMATE_SAR = {"attraction": 50.0, "restaurant": 80.0, "cafe": 35.0}
CATEGORY_VISIT_DURATION_HOURS = {"attraction": 2.0, "restaurant": 1.5, "cafe": 1.0}

# ============================================================
# ML ARTIFACT LOADING (cached once per session)
# ============================================================

@cache_resource(show_spinner=False)
def _load_ml_artifacts():
    """Load recommendation context plus the optional trained city-demand model once.

    The recommendation path requires only grounded CSV context artifacts. The forecast
    model is optional so the website can still serve recommendations if joblib/model
    loading fails.
    """
    try:
        city_monthly = pd.read_csv(ARTIFACT_ROOT / "kapsarc_city_monthly_features.csv")
        sector_monthly = pd.read_csv(ARTIFACT_ROOT / "kapsarc_sector_monthly_features.csv")
        city_context = pd.read_csv(ARTIFACT_ROOT / "city_demand_context.csv")
        sector_context = pd.read_csv(ARTIFACT_ROOT / "sector_demand_context.csv")
        seasonality = pd.read_csv(ARTIFACT_ROOT / "datasaudi_seasonality_index.csv")
        metadata = json.loads((ARTIFACT_ROOT / "deployment_metadata.json").read_text(encoding="utf-8"))
        city_monthly["month"] = pd.to_datetime(city_monthly["month"], errors="coerce")
        sector_monthly["month"] = pd.to_datetime(sector_monthly["month"], errors="coerce")
        for frame in (city_monthly, sector_monthly, city_context, sector_context, seasonality):
            if frame.empty:
                return None

        forecast_model = None
        model_path = ARTIFACT_ROOT / "city_demand_model.joblib"
        if joblib is not None and model_path.exists():
            try:
                forecast_model = joblib.load(model_path)
            except Exception:
                forecast_model = None

        metrics = None
        metrics_path = ARTIFACT_ROOT / "city_demand_metrics.json"
        if metrics_path.exists():
            try:
                metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
            except (ValueError, json.JSONDecodeError):
                metrics = None

        return {
            "city_monthly": city_monthly,
            "sector_monthly": sector_monthly,
            "city_context": city_context,
            "sector_context": sector_context,
            "seasonality": seasonality,
            "metadata": metadata,
            "forecast_model": forecast_model,
            "forecast_metrics": metrics,
        }
    except (FileNotFoundError, ValueError, json.JSONDecodeError, pd.errors.ParserError):
        return None


def ml_artifacts_available() -> bool:
    return _load_ml_artifacts() is not None


def forecast_model_available() -> bool:
    artifacts = _load_ml_artifacts()
    return bool(artifacts and artifacts.get("forecast_model") is not None)


# ============================================================
# EVENTS (Visit Saudi / Saudi Calendar, per the plan)
# ------------------------------------------------------------
# There is no public, keyless, free equivalent of the Visit Saudi events
# feed. Rather than fake events or scrape a source with no clear license,
# this reads an optional VISIT_SAUDI_API_BASE / VISIT_SAUDI_API_KEY from
# the environment: if a team member has real (even free-tier) API
# credentials, dropping them into st.secrets / env vars turns this on
# with no other code changes. Without credentials it returns an empty,
# clearly-labeled result -- consistent with the plan's own grounding
# rule to omit unsupported/unverifiable events rather than invent them.
# ============================================================

VISIT_SAUDI_API_BASE = os.environ.get("VISIT_SAUDI_API_BASE", "")
VISIT_SAUDI_API_KEY = os.environ.get("VISIT_SAUDI_API_KEY", "")


def events_source_configured() -> bool:
    return bool(VISIT_SAUDI_API_BASE and VISIT_SAUDI_API_KEY)


# ============================================================
# LLM-GROUNDED ASSISTANT (optional upgrade over the rule-based
# keyword matcher below). Uses the Anthropic API directly with a
# system prompt that restricts it to the retrieved place/itinerary
# context only -- it's told explicitly not to answer from outside
# knowledge, so it can't invent prices, hours, or places that
# weren't actually retrieved. Turns on automatically if
# ANTHROPIC_API_KEY is set; otherwise the app silently keeps using
# the existing rule-based assistant, so nothing breaks without a key.
# ============================================================

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")

# Groq: a genuinely free (no credit card) LLM API, OpenAI-compatible.
# Get a key at console.groq.com/keys. Checked first below since it's
# free -- Anthropic is used only as a paid fallback if a Groq key
# isn't set but an Anthropic key is.
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")


def llm_configured() -> bool:
    return bool(GROQ_API_KEY or ANTHROPIC_API_KEY)


def llm_provider_name() -> str:
    if GROQ_API_KEY:
        return "Groq (free)"
    if ANTHROPIC_API_KEY:
        return "Claude (paid)"
    return "none"


def _build_grounding_system_prompt(context, state):
    return (
        "You are a Saudi tourism trip-planning assistant embedded in an app. "
        "You must answer ONLY using the VERIFIED_CONTEXT JSON provided below -- "
        "this is the actual data retrieved for the user's current trip (real "
        "places, an itinerary, or both). Do not use outside knowledge about "
        "Saudi Arabia, and do not invent places, prices, hours, or facts that "
        "are not in VERIFIED_CONTEXT. If the user asks something the context "
        "doesn't cover, say plainly that you don't have that information yet "
        "rather than guessing. Keep answers short and practical.\n\n"
        f"Current trip settings: {json.dumps(state, ensure_ascii=False)}\n\n"
        f"VERIFIED_CONTEXT: {json.dumps(context, ensure_ascii=False, default=str)}"
    )


def _generate_groq_response(user_message, context, state, chat_history=None):
    system_prompt = _build_grounding_system_prompt(context, state)
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(chat_history or [])
    messages.append({"role": "user", "content": user_message})
    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"model": GROQ_MODEL, "max_tokens": 400, "messages": messages},
            timeout=HTTP_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        return (text.strip() or None), None
    except (requests.RequestException, ValueError, KeyError, IndexError) as e:
        return None, str(e)


def _generate_anthropic_response(user_message, context, state, chat_history=None):
    system_prompt = _build_grounding_system_prompt(context, state)
    messages = list(chat_history or [])
    messages.append({"role": "user", "content": user_message})
    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": 400,
                "system": system_prompt,
                "messages": messages,
            },
            timeout=HTTP_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        data = resp.json()
        text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
        return (text.strip() or None), None
    except (requests.RequestException, ValueError, KeyError) as e:
        return None, str(e)


def generate_llm_response(user_message, context, state, chat_history=None):
    """Calls whichever grounded LLM provider is configured (Groq first,
    since it's free; Anthropic as a paid fallback). Returns
    (response_text, error). On any failure, error is a short string and
    the caller should fall back to generate_assistant_response()."""
    if GROQ_API_KEY:
        return _generate_groq_response(user_message, context, state, chat_history)
    if ANTHROPIC_API_KEY:
        return _generate_anthropic_response(user_message, context, state, chat_history)
    return None, "no LLM API key configured"


@cache_data(ttl=CACHE_TTL_SECONDS, show_spinner=False)
def fetch_events(city: str) -> list:
    if not events_source_configured():
        return []
    try:
        resp = requests.get(
            f"{VISIT_SAUDI_API_BASE}/events",
            params={"city": city},
            headers={"Authorization": f"Bearer {VISIT_SAUDI_API_KEY}"},
            timeout=HTTP_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        payload = resp.json()
    except (requests.RequestException, ValueError):
        return []
    retrieved = pd.Timestamp.utcnow().isoformat()
    events = []
    for row in payload.get("results", []):
        events.append({
            "name": row.get("name"),
            "start_date": row.get("start_date"),
            "end_date": row.get("end_date"),
            "venue": row.get("venue"),
            "city": city,
            "source": "Visit Saudi Calendar",
            "source_retrieved_at_utc": retrieved,
        })
    return events


# ============================================================
# ML HELPERS (adapted from ml_api_service.py)
# ============================================================

def _normalize_text(value) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return ""
    s = str(value).strip().lower()
    s = re.sub(r"[\u200e\u200f]", "", s)
    s = re.sub(r"[^a-z0-9\u0600-\u06ff]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _minmax01(series: pd.Series, neutral: float = 0.5) -> pd.Series:
    s = pd.to_numeric(series, errors="coerce")
    lo, hi = s.min(), s.max()
    if pd.isna(lo) or pd.isna(hi) or np.isclose(lo, hi):
        return pd.Series(neutral, index=series.index, dtype=float)
    return ((s - lo) / (hi - lo)).clip(0, 1)


def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    vals = [lat1, lon1, lat2, lon2]
    if any(pd.isna(v) for v in vals):
        return float("nan")
    r = 6371.0088
    p1, p2 = math.radians(float(lat1)), math.radians(float(lat2))
    dp = math.radians(float(lat2) - float(lat1))
    dl = math.radians(float(lon2) - float(lon1))
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _canonical_place_group(category: str) -> str:
    if category in {"restaurants", "cafes"}:
        return "food"
    return "attractions" if category == "attractions" else category


_INTEREST_ALIASES = {
    "culture": "culture & heritage",
    "heritage": "culture & heritage",
    "culture and heritage": "culture & heritage",
    "culture & heritage": "culture & heritage",
    "culture heritage": "culture & heritage",
    "food": "food",
    "nature": "nature",
    "adventure": "adventure",
    "shopping": "shopping",
    "relaxation": "relaxation",
    "attractions": "attractions",
    "attraction": "attractions",
    "restaurants": "restaurants",
    "restaurant": "restaurants",
    "cafes": "cafes",
    "cafe": "cafes",
}


def _canonical_interest(value: str) -> str:
    cleaned = str(value).strip().lower().replace("&", "and")
    key = _normalize_text(cleaned)
    if "culture" in key or "heritage" in key:
        return "culture & heritage"
    return _INTEREST_ALIASES.get(key, key)


def map_interests_to_categories(interests) -> list[str]:
    """Map UI/product interests to categories supported by the team Places API.

    Empty interests intentionally means broad cold-start retrieval across all
    supported categories. Order is stable for deterministic tests/UI behavior.
    """
    normalized = [_canonical_interest(i) for i in _normalize_interests(interests)]
    if not normalized:
        return list(SUPPORTED_PLACE_CATEGORIES)
    requested = set()
    for interest in normalized:
        requested.update(INTEREST_CATEGORY_MAP.get(interest, ()))
    if not requested:
        return list(SUPPORTED_PLACE_CATEGORIES)
    return [c for c in SUPPORTED_PLACE_CATEGORIES if c in requested]


def interest_match_score(row, user_interests) -> float:
    """Grounded preference score using only retrieved category/name/address text.

    The current normalized Places API has coarse categories, so fine-grained
    Culture/Nature/Adventure/etc. matching uses explicit keywords in the venue
    name/address/category. A generic attraction receives a partial match rather
    than being falsely labeled as a specific style.
    """
    interests = [_canonical_interest(i) for i in _normalize_interests(user_interests)]
    if not interests:
        return 0.5

    requested_category = _normalize_text(row.get("requested_category", ""))
    text = " ".join(
        _normalize_text(row.get(k, ""))
        for k in ("name", "address", "category")
    )
    per_interest = []
    for interest in interests:
        if interest == "food":
            per_interest.append(1.0 if requested_category in {"restaurants", "cafes"} else 0.0)
            continue
        if interest in {"restaurants", "cafes", "attractions"}:
            per_interest.append(1.0 if requested_category == interest else 0.0)
            continue

        keywords = INTEREST_KEYWORDS.get(interest, ())
        keyword_hit = any(_normalize_text(k) in text for k in keywords)
        if keyword_hit:
            per_interest.append(1.0)
        elif interest == "relaxation" and requested_category == "cafes":
            per_interest.append(0.8)
        elif requested_category == "attractions":
            per_interest.append(0.35)
        else:
            per_interest.append(0.0)

    return float(max(per_interest, default=0.5))


_LIVE_JUNK_PATTERNS = re.compile(
    r"(?:^unknown place$|^work$|^\d+$|\btrading\b|\bworkshop\b|\boffice\b|"
    r"\bprinting\b|\bsaudiairlance\b|\bmaktab\s*\d*\b|\bstreet$|\broad$|"
    r"شركة|مؤسسة|مكتب|صالون|مطابع|سفريات)",
    re.IGNORECASE,
)


def _is_grounded_live_candidate(row) -> bool:
    name = str(row.get("name") or "").strip()
    if not name or _LIVE_JUNK_PATTERNS.search(name):
        return False
    # Purely numeric or punctuation-only names are not useful venue identities.
    if not re.search(r"[A-Za-z\u0600-\u06ff]", name):
        return False
    return True


def _normalized_name_key(name: str) -> str:
    key = _normalize_text(name)
    return re.sub(r"\b(entrance|gate|مدخل|بوابة)\b", "", key).strip()


# ============================================================
# OPENING HOURS (hard constraint) -- lightweight OSM/Geoapify
# "opening_hours" syntax parser. Not a full spec implementation,
# but handles the common patterns well enough to hard-filter
# venues that are confirmed closed on the visit day, per the
# plan's requirement that opening hours be a hard constraint.
# Unknown/unparseable strings are treated as "unknown" (soft --
# not excluded) rather than fabricating a status.
# ============================================================

_WEEKDAY_CODES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]


def _parse_opening_hours(raw: str):
    """Returns dict {weekday_code: [(start_hour, end_hour), ...]} or None
    if unparseable / unknown. "24/7" maps every day to (0, 24)."""
    if not isinstance(raw, str) or not raw.strip():
        return None
    text = raw.strip()
    if text.lower() in {"24/7", "open 24 hours"}:
        return {d: [(0.0, 24.0)] for d in _WEEKDAY_CODES}

    schedule = {}
    for segment in text.split(";"):
        segment = segment.strip()
        if not segment or segment.lower() in {"closed", "off", "ph off"}:
            continue
        m = re.match(
            r"^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?"
            r"(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+"
            r"(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$",
            segment,
        )
        if not m:
            continue
        day_part, sh, sm, eh, em = m.groups()
        start_hr = int(sh) + int(sm) / 60.0
        end_hr = int(eh) + int(em) / 60.0
        days = set()
        for chunk in day_part.split(","):
            if "-" in chunk:
                d1, d2 = chunk.split("-")
                i1, i2 = _WEEKDAY_CODES.index(d1), _WEEKDAY_CODES.index(d2)
                idxs = list(range(i1, i2 + 1)) if i2 >= i1 else list(range(i1, 7)) + list(range(0, i2 + 1))
                days.update(_WEEKDAY_CODES[i] for i in idxs)
            else:
                days.add(chunk)
        for d in days:
            schedule.setdefault(d, []).append((start_hr, end_hr))
    return schedule or None


def opening_hours_status(raw: str, visit_weekday: int, visit_hour: float = 12.0):
    """visit_weekday: Python weekday() (Mon=0..Sun=6).
    Returns one of "open", "closed", "unknown" -- never fabricates certainty
    beyond what the parsed string supports."""
    schedule = _parse_opening_hours(raw)
    if schedule is None:
        return "unknown"
    code = _WEEKDAY_CODES[visit_weekday]
    windows = schedule.get(code)
    if not windows:
        return "closed"
    for start_hr, end_hr in windows:
        if start_hr <= visit_hour <= end_hr:
            return "open"
    return "closed"


def accessibility_status(row) -> str:
    """Best-effort accessibility read from whatever the upstream Places API
    passed through (e.g. an OSM 'wheelchair' tag), since the ML metadata
    explicitly notes confirmed accessibility isn't exposed by the current
    normalized API. Returns "yes" / "no" / "unknown" -- "unknown" is the
    honest default, never assumed accessible."""
    for key in ("wheelchair", "accessibility", "accessible"):
        val = row.get(key) if hasattr(row, "get") else None
        if val is None:
            continue
        v = str(val).strip().lower()
        if v in {"yes", "true", "1", "full", "limited"}:
            return "yes"
        if v in {"no", "false", "0"}:
            return "no"
    return "unknown"


_UPSTREAM_FAILURE_CACHE: dict = {}
_HOST_FAILURE_TIMESTAMP: float = 0.0

@cache_data(ttl=CACHE_TTL_SECONDS, show_spinner=False)
def _fetch_places_from_upstream(city: str, category: str, limit: int) -> list:
    """Calls the live Places API. Cached per (city, category, limit) for 15 min.
    Implements a cooldown on upstream failure so cold-starts/unreachable
    endpoints degrade instantly to verified snapshot fallbacks without stalling."""
    global _HOST_FAILURE_TIMESTAMP
    now = time.monotonic()
    if _HOST_FAILURE_TIMESTAMP and (now - _HOST_FAILURE_TIMESTAMP < 60.0):
        raise requests.RequestException("Upstream host in failure cooldown")

    fail_key = (city, category)
    last_fail = _UPSTREAM_FAILURE_CACHE.get(fail_key)
    if last_fail and (now - last_fail < 60.0):
        raise requests.RequestException(f"Upstream {city}/{category} in cooldown after recent error")

    try:
        response = requests.get(
            f"{PLACES_API_BASE}/places",
            params={"city": city, "category": category, "limit": limit},
            timeout=HTTP_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        _HOST_FAILURE_TIMESTAMP = 0.0
    except Exception as exc:
        _UPSTREAM_FAILURE_CACHE[fail_key] = now
        _HOST_FAILURE_TIMESTAMP = now
        raise exc

    retrieved = pd.Timestamp.utcnow().isoformat()
    rows = []
    for row in payload.get("results", []):
        item = dict(row)
        item["requested_city"] = city
        item["requested_category"] = category
        item["source"] = "Geoapify via team Places API"
        item["source_retrieved_at_utc"] = retrieved
        rows.append(item)
    return rows


def _prepare_places(rows: list) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame()
    out = pd.DataFrame(rows)
    expected = [
        "name", "latitude", "longitude", "category", "address", "city",
        "opening_hours", "place_id", "requested_city", "requested_category",
        "source", "source_retrieved_at_utc",
    ]
    for col in expected:
        if col not in out.columns:
            out[col] = np.nan

    out = out[out.apply(_is_grounded_live_candidate, axis=1)].copy()
    if out.empty:
        return out

    out["latitude"] = pd.to_numeric(out["latitude"], errors="coerce")
    out["longitude"] = pd.to_numeric(out["longitude"], errors="coerce")
    out["city_effective"] = out["city"].fillna(out["requested_city"]).astype(str)
    out["city_key"] = out["city_effective"].map(_normalize_text)
    out["place_group"] = out["requested_category"].map(_canonical_place_group)
    out["has_name"] = out["name"].notna().astype(float)
    out["has_coordinates"] = (out["latitude"].notna() & out["longitude"].notna()).astype(float)
    out["has_address"] = out["address"].notna().astype(float)
    out["has_opening_hours"] = out["opening_hours"].notna().astype(float)
    out["place_quality"] = out[
        ["has_name", "has_coordinates", "has_address", "has_opening_hours"]
    ].mean(axis=1)
    out["accessibility_status"] = out.apply(accessibility_status, axis=1)

    # First dedupe stable IDs; then dedupe repeated names that Geoapify can return
    # under multiple nearby features/entrances.
    out["_id_key"] = out["place_id"].fillna(
        out["name"].fillna("") + "|" + out["latitude"].astype(str) + "|" + out["longitude"].astype(str)
    )
    out = out.drop_duplicates("_id_key")
    out["_name_key"] = out["name"].map(_normalized_name_key)
    out = out.sort_values(
        ["place_quality", "has_coordinates"], ascending=[False, False]
    ).drop_duplicates(["requested_city", "requested_category", "_name_key"])
    return out.drop(columns=["_id_key", "_name_key"]).reset_index(drop=True)


def _city_demand_component(artifacts, city_key: str):
    frame = artifacts["city_context"]
    normalized = _normalize_text(city_key)
    match = frame[frame["city_key"].astype(str).map(_normalize_text) == normalized]
    if not match.empty:
        return float(match["city_demand_score"].iloc[0]), "city_observed"
    # AlUla and other uncovered cities get a transparent neutral/median fallback;
    # we never pretend Madinah city totals are AlUla city totals.
    values = pd.to_numeric(frame["city_demand_score"], errors="coerce").dropna()
    return (float(values.median()) if not values.empty else 0.5), "national_city_median_fallback"


def _sector_demand_component(artifacts, place_group: str):
    frame = artifacts["sector_context"]
    match = frame[frame["place_group"].astype(str) == str(place_group)]
    if not match.empty:
        return float(match["sector_demand_score"].iloc[0]), "national_sector_observed"
    values = pd.to_numeric(frame["sector_demand_score"], errors="coerce").dropna()
    return (float(values.median()) if not values.empty else 0.5), "national_sector_median_fallback"


def _regional_demand_components(artifacts, city_key: str, place_group: str):
    city_score, city_source = _city_demand_component(artifacts, city_key)
    sector_score, sector_source = _sector_demand_component(artifacts, place_group)
    score = (0.4 * city_score) + (0.6 * sector_score)
    return float(max(0.0, min(1.0, score))), city_score, sector_score, f"{city_source}+{sector_source}"


def _regional_demand_score(artifacts, city_key: str, place_group: str) -> float:
    return _regional_demand_components(artifacts, city_key, place_group)[0]


def _seasonality_score(artifacts, city: str, month_num: int):
    frame = artifacts["seasonality"]
    pkey = CITY_TO_PROVINCE.get(_normalize_text(city))
    if pkey:
        candidates = frame[
            (pd.to_numeric(frame["month_num"], errors="coerce") == int(month_num))
            & frame["province_key"].astype(str).map(_normalize_text).str.contains(pkey, regex=False, na=False)
        ]
        if not candidates.empty:
            return float(candidates["seasonality_score"].mean()), "province_month"

    national = frame[pd.to_numeric(frame["month_num"], errors="coerce") == int(month_num)]
    if not national.empty:
        return float(national["seasonality_score"].mean()), "national_month_fallback"
    return 0.5, "neutral_fallback"


def _weighted_score(row: pd.Series) -> float:
    total, used = 0.0, 0.0
    for feature, weight in RANK_WEIGHTS.items():
        value = row.get(feature, np.nan)
        if weight <= 0 or pd.isna(value):
            continue
        total += float(value) * weight
        used += weight
    return total / used if used else 0.0


def _diversity_rerank(candidates: pd.DataFrame, top_k: int) -> pd.DataFrame:
    """Small deterministic category-repeat penalty after grounded scoring.

    It improves mixed-interest lists without overriding strong preference relevance.
    For single-category requests this is equivalent to score ordering.
    """
    if candidates.empty or top_k <= 0:
        return candidates.head(0)
    remaining = candidates.copy()
    selected = []
    category_counts = {}
    while not remaining.empty and len(selected) < top_k:
        adjusted = []
        for idx, row in remaining.iterrows():
            category = row.get("requested_category")
            repeat_count = category_counts.get(category, 0)
            penalty = min(0.12, 0.04 * repeat_count)
            novelty_bonus = 0.02 if repeat_count == 0 and category_counts else 0.0
            adjusted.append((float(row["ranking_score"]) - penalty + novelty_bonus, idx))
        _, best_idx = max(adjusted, key=lambda x: (x[0], str(remaining.loc[x[1]].get("name", ""))))
        best = remaining.loc[best_idx].copy()
        selected.append(best)
        category = best.get("requested_category")
        category_counts[category] = category_counts.get(category, 0) + 1
        remaining = remaining.drop(index=best_idx)
    return pd.DataFrame(selected).reset_index(drop=True)


def fetch_ml_recommendations(city, interests, trip_month, top_k=10, require_accessibility=False):
    """Retrieve live grounded venues and rank them with contextual evidence.

    KAPSARC city and national-sector signals are combined as contextual features;
    this function never claims KAPSARC contains observed city-by-sector spending.
    """
    artifacts = _load_ml_artifacts()
    if artifacts is None:
        return None

    retrieval_categories = map_interests_to_categories(interests)
    per_category_limit = min(50, max(top_k * 4, 20))
    raw_rows = []
    upstream_failures = []
    for category in retrieval_categories:
        try:
            raw_rows.extend(
                _fetch_places_from_upstream(city, category, per_category_limit)
            )
        except (requests.RequestException, ValueError) as exc:
            upstream_failures.append((category, str(exc)))

    # Preserve successfully retrieved grounded categories if one upstream
    # category fails. Only fall back when every requested category failed
    # or returned no grounded rows.
    if not raw_rows:
        return None

    candidates = _prepare_places(raw_rows)
    if candidates.empty:
        return None

    if require_accessibility:
        # Strict means confirmed accessible. Unknown evidence is not sufficient.
        candidates = candidates[candidates["accessibility_status"] == "yes"].copy()
        if candidates.empty:
            return None

    candidates["preference_match"] = candidates.apply(
        lambda row: interest_match_score(row, interests), axis=1
    )

    components = candidates.apply(
        lambda r: _regional_demand_components(artifacts, r["city_key"], r["place_group"]),
        axis=1,
    )
    candidates["regional_demand"] = [x[0] for x in components]
    candidates["city_demand_score"] = [x[1] for x in components]
    candidates["sector_demand_score"] = [x[2] for x in components]
    candidates["regional_demand_source"] = [x[3] for x in components]

    seas = candidates["requested_city"].map(lambda c: _seasonality_score(artifacts, c, trip_month))
    candidates["seasonality"] = [x[0] for x in seas]
    candidates["seasonality_source"] = [x[1] for x in seas]

    center = CITY_CENTERS.get(city)
    if center:
        candidates["distance_km_center"] = candidates.apply(
            lambda r: _haversine_km(r["latitude"], r["longitude"], center[0], center[1]), axis=1
        )
        candidates["distance_fit"] = 1.0 - _minmax01(candidates["distance_km_center"])
    else:
        candidates["distance_km_center"] = np.nan
        candidates["distance_fit"] = np.nan

    candidates["opening_hours_raw"] = candidates["opening_hours"]
    candidates["ranking_score"] = candidates.apply(_weighted_score, axis=1)
    candidates = candidates.sort_values(
        ["ranking_score", "place_quality", "name"],
        ascending=[False, False, True],
        na_position="last",
    )
    ranked = _diversity_rerank(candidates, top_k)

    ranked["place_type"] = ranked["requested_category"].str.rstrip("s")
    ranked["recommendation_score"] = ranked["ranking_score"]
    ranked["popularity_score"] = ranked["place_quality"]  # legacy response field only; not a rating
    ranked["distance_score"] = ranked["distance_fit"]
    ranked["city"] = city
    ranked["_source"] = "hybrid_context_ranker"
    return ranked.reset_index(drop=True)


def predict_next_month_city_demand(city: str):
    """One-month-ahead city-total KAPSARC POS forecast using the deployed model."""
    artifacts = _load_ml_artifacts()
    if not artifacts or artifacts.get("forecast_model") is None:
        return None
    monthly = artifacts["city_monthly"].copy()
    target_city = _normalize_text(city)
    subset = monthly[monthly["City"].astype(str).map(_normalize_text) == target_city].sort_values("month")
    if subset.empty:
        return None
    value_col = "transaction_value_thousand_sar"
    history = pd.to_numeric(subset[value_col], errors="coerce").dropna()
    if len(history) < 12:
        return None
    target_month = pd.Timestamp(subset["month"].max()) + pd.offsets.MonthBegin(1)
    first_year = int(pd.to_datetime(monthly["month"]).dt.year.min())
    feature_row = pd.DataFrame([{
        "group_key": target_city,
        "year": int(target_month.year),
        "month_num": int(target_month.month),
        "month_sin": float(np.sin(2 * np.pi * target_month.month / 12)),
        "month_cos": float(np.cos(2 * np.pi * target_month.month / 12)),
        "trend_months": int((target_month.year - first_year) * 12 + target_month.month),
        "lag_1": float(history.iloc[-1]),
        "lag_2": float(history.iloc[-2]),
        "lag_3": float(history.iloc[-3]),
        "lag_6": float(history.iloc[-6]),
        "lag_12": float(history.iloc[-12]),
        "rolling_3": float(history.iloc[-3:].mean()),
        "rolling_6": float(history.iloc[-6:].mean()),
        "rolling_12": float(history.iloc[-12:].mean()),
        "rolling_std_3": float(history.iloc[-3:].std(ddof=1)),
        "rolling_std_6": float(history.iloc[-6:].std(ddof=1)),
        "rolling_std_12": float(history.iloc[-12:].std(ddof=1)),
    }])
    features = artifacts["metadata"].get("forecast_model", {}).get("features", list(feature_row.columns))
    prediction = float(artifacts["forecast_model"].predict(feature_row[features])[0])
    if not np.isfinite(prediction):
        return None
    return {
        "city": city,
        "forecast_month": target_month.strftime("%Y-%m"),
        "forecast_horizon_months": 1,
        "target": "monthly city-total POS transaction value",
        "unit": "thousand SAR",
        "predicted_transaction_value_thousand_sar": max(0.0, prediction),
        "seasonal_naive_baseline": float(history.iloc[-12]),
        "model_version": artifacts["metadata"].get("model_version"),
    }


# ============================================================
# RECOMMENDATION ENGINE (public entry point used by app.py)
# ============================================================

def recommend_places(city, interests, budget=None, features_df=None, top_n=10,
                      require_accessibility=False, excluded_places=None, trip_month=None):
    interest_list = _normalize_interests(interests)
    excluded_places = set(excluded_places or [])
    trip_month = int(trip_month or pd.Timestamp.now().month)

    # --- 1) Grounded live recommendation path ---
    ml_df = fetch_ml_recommendations(
        city=city,
        interests=interest_list,
        trip_month=trip_month,
        top_k=top_n + len(excluded_places),
        require_accessibility=require_accessibility,
    )
    if ml_df is not None and not ml_df.empty:
        if excluded_places:
            ml_df = ml_df[~ml_df["name"].isin(excluded_places)]
        backfilled = _backfill_local_fields(ml_df, city, features_df)
        # Estimated prices are used only by itinerary feasibility, not to claim
        # venue-level recommendation evidence.
        return backfilled.sort_values(
            "recommendation_score", ascending=False
        ).head(top_n).reset_index(drop=True)

    # --- 2) Local static fallback when the live Places API is unavailable ---
    if features_df is None or city not in LOCAL_DATA_CITIES:
        return pd.DataFrame()

    # The bundled fallback dataset has no confirmed accessibility evidence.
    # Strict accessibility therefore cannot honestly return fallback venues.
    if require_accessibility:
        return pd.DataFrame()

    places = features_df[features_df["city"] == city].copy()
    if excluded_places:
        places = places[~places["name"].isin(excluded_places)]
    if places.empty:
        return places

    places = places[places.apply(_is_grounded_live_candidate, axis=1)].copy()
    if places.empty:
        return places

    plural = {"attraction": "attractions", "restaurant": "restaurants", "cafe": "cafes"}
    places["requested_category"] = places["place_type"].map(plural)
    allowed_categories = set(map_interests_to_categories(interest_list))
    places = places[places["requested_category"].isin(allowed_categories)].copy()
    if places.empty:
        return places
    places["category"] = places.get("categories", "")
    if "address" not in places.columns:
        places["address"] = f"{city}, Saudi Arabia"
    else:
        places["address"] = places["address"].fillna(f"{city}, Saudi Arabia")
    places["preference_match"] = places.apply(
        lambda row: interest_match_score(row, interest_list), axis=1
    )
    # Static popularity_score is not a user rating; keep it as a small fallback
    # context term only, with preference and distance dominating.
    places["recommendation_score"] = (
        places["preference_match"] * 0.60
        + places["distance_score"] * 0.25
        + places["popularity_score"] * 0.15
    )
    places["_source"] = "local_dataset_fallback"
    places["source"] = "Bundled Geoapify/OpenStreetMap fallback dataset"
    places["source_retrieved_at_utc"] = None
    places["opening_hours_raw"] = None
    places["accessibility_status"] = "unknown"
    places["cost_is_estimate"] = True
    places["visit_duration_hours"] = places["place_type"].map(
        CATEGORY_VISIT_DURATION_HOURS
    ).fillna(1.5)
    places["total_time_hours"] = places["visit_duration_hours"]
    places = places.sort_values(by="recommendation_score", ascending=False)
    return places.head(top_n).reset_index(drop=True)


def baseline_recommend_places(city, features_df, top_n=10):
    """Non-personalized baseline required by the plan for cold-start and
    evaluation: rank purely by regional demand, using distance to the
    city center as a tie-breaker. No interests/budget considered."""
    ml_df = fetch_ml_recommendations(
        city=city, interests=["attractions", "restaurants", "cafes"],
        trip_month=pd.Timestamp.now().month, top_k=top_n,
    )
    if ml_df is not None and not ml_df.empty:
        return ml_df.sort_values(
            ["regional_demand", "distance_fit"], ascending=[False, False]
        ).head(top_n).reset_index(drop=True)

    if features_df is None or city not in LOCAL_DATA_CITIES:
        return pd.DataFrame()
    places = features_df[features_df["city"] == city].copy()
    if places.empty:
        return places
    return places.sort_values(
        ["popularity_score", "distance_score"], ascending=[False, False]
    ).head(top_n).reset_index(drop=True)


def _normalize_interests(interests):
    if isinstance(interests, str):
        parts = re.split(r"[,\n/]+", interests)
        return [p.strip().lower() for p in parts if p.strip()]
    if isinstance(interests, (list, tuple, set)):
        return [str(i).strip().lower() for i in interests if str(i).strip()]
    return []


def calculate_interest_score(place_interests, user_interests):
    if not user_interests:
        return 0.5
    if isinstance(place_interests, str):
        place_tags = [t.strip().lower() for t in re.split(r"[,;/]+", place_interests) if t.strip()]
    elif isinstance(place_interests, (list, tuple, set)):
        place_tags = [str(t).strip().lower() for t in place_interests]
    else:
        place_tags = []
    if not place_tags:
        return 0.0
    matches = sum(1 for u in user_interests if any(u in tag or tag in u for tag in place_tags))
    return min(1.0, matches / len(user_interests))


def calculate_budget_score(estimated_cost, budget):
    if budget is None or pd.isna(budget) or budget <= 0:
        return 0.5
    if pd.isna(estimated_cost):
        return 0.5
    if estimated_cost <= budget:
        return 1.0
    overage_ratio = (estimated_cost - budget) / budget
    return max(0.0, 1.0 - overage_ratio)


def _backfill_local_fields(ml_df, city, features_df):
    """Attach clearly-labeled category-level cost/duration estimates.

    The bundled local dataset uses fixed category costs (50/80/35 SAR), so even
    an exact-name match is still an estimate rather than a verified venue price.
    """
    ml_df = ml_df.copy()
    if "estimated_cost" not in ml_df.columns:
        ml_df["estimated_cost"] = np.nan

    if features_df is not None and city in LOCAL_DATA_CITIES:
        local = features_df[features_df["city"] == city][["name", "estimated_cost"]].drop_duplicates("name")
        ml_df = ml_df.merge(local, on="name", how="left", suffixes=("", "_local"))
        if "estimated_cost_local" in ml_df.columns:
            ml_df["estimated_cost"] = ml_df["estimated_cost"].fillna(ml_df["estimated_cost_local"])
            ml_df = ml_df.drop(columns=["estimated_cost_local"])

    category_cost = ml_df["place_type"].map(CATEGORY_COST_ESTIMATE_SAR)
    ml_df["estimated_cost"] = pd.to_numeric(ml_df["estimated_cost"], errors="coerce").fillna(category_cost).fillna(50.0)
    ml_df["cost_is_estimate"] = True
    ml_df["cost_estimate_basis"] = "category-level heuristic from bundled project data"

    ml_df["visit_duration_hours"] = ml_df["place_type"].map(
        CATEGORY_VISIT_DURATION_HOURS
    ).fillna(1.5)
    ml_df["duration_is_estimate"] = True
    ml_df["total_time_hours"] = ml_df["visit_duration_hours"]
    ml_df["_estimates_used"] = True
    return ml_df


# ============================================================
# ITINERARY
# ============================================================

def _route_order(places_left, start_latlon):
    """Greedy nearest-neighbor ordering by haversine distance -- a free
    stand-in for the paid Google Routes optimization the plan called for.
    Returns places_left re-ordered, plus the list of leg distances (km)."""
    remaining = list(places_left)
    ordered, leg_km = [], []
    cur = start_latlon
    while remaining:
        best_i, best_d = 0, float("inf")
        for i, p in enumerate(remaining):
            d = _haversine_km(cur[0], cur[1], p.get("latitude"), p.get("longitude"))
            if pd.isna(d):
                d = 999999.0  # unknown location -> visit last
            if d < best_d:
                best_d, best_i = d, i
        nxt = remaining.pop(best_i)
        ordered.append(nxt)
        leg_km.append(0.0 if best_d == 999999.0 else best_d)
        if not pd.isna(nxt.get("latitude")) and not pd.isna(nxt.get("longitude")):
            cur = (nxt["latitude"], nxt["longitude"])
    return ordered, leg_km


def generate_itinerary(recommendations, budget, days, hours_per_day, city=None,
                        visit_start_weekday=None, require_accessibility=False,
                        transport_mode="Driving / Taxi", day_start_hour=9.0):
    """Build a grounded, constraint-aware day-by-day itinerary.

    Hard constraints:
      * total trip budget (using clearly-labeled category estimates),
      * daily time limit,
      * confirmed opening-hours closure,
      * confirmed accessibility when strict accessibility is requested.

    Route legs are recomputed after every actually scheduled stop. Distances use
    Haversine × ROUTE_DISTANCE_FACTOR and are therefore estimates, not live roads/traffic.
    """
    if recommendations is None or recommendations.empty:
        return pd.DataFrame()
    if days <= 0 or hours_per_day <= 0 or budget is None or budget <= 0:
        return pd.DataFrame()

    speed_kmh = TRANSPORT_SPEED_KMH.get(transport_mode, ASSUMED_TRAVEL_SPEED_KMH)
    start_weekday = visit_start_weekday if visit_start_weekday is not None else pd.Timestamp.now().weekday()
    center = CITY_CENTERS.get(city)

    candidates = []
    for _, place in recommendations.iterrows():
        row = place.to_dict()
        if require_accessibility and row.get("accessibility_status") != "yes":
            continue
        lat = pd.to_numeric(pd.Series([row.get("latitude")]), errors="coerce").iloc[0]
        lon = pd.to_numeric(pd.Series([row.get("longitude")]), errors="coerce").iloc[0]
        if pd.isna(lat) or pd.isna(lon):
            # A stop with unknown coordinates cannot be routed honestly.
            continue
        row["latitude"], row["longitude"] = float(lat), float(lon)
        row["estimated_cost"] = float(row.get("estimated_cost") or 0.0)
        row["total_time_hours"] = float(
            row.get("total_time_hours") or row.get("visit_duration_hours") or 1.5
        )
        row["visit_duration_hours"] = float(
            row.get("visit_duration_hours") or row["total_time_hours"]
        )
        candidates.append(row)

    if not candidates:
        return pd.DataFrame()

    remaining = candidates[:]
    itinerary = []
    total_spent = 0.0

    for day in range(1, days + 1):
        if not remaining:
            break
        weekday = (start_weekday + day - 1) % 7
        day_time = 0.0
        cursor = center if center is not None else (
            remaining[0]["latitude"], remaining[0]["longitude"]
        )

        while remaining:
            feasible = []
            for idx, place in enumerate(remaining):
                straight_km = _haversine_km(
                    cursor[0], cursor[1], place["latitude"], place["longitude"]
                )
                if pd.isna(straight_km):
                    continue
                road_km = float(straight_km) * ROUTE_DISTANCE_FACTOR
                travel_hr = road_km / speed_kmh if speed_kmh > 0 else float("inf")
                visit_hr = float(place["total_time_hours"])
                stop_time = travel_hr + visit_hr
                stop_cost = float(place["estimated_cost"])

                # Total budget is a hard trip-level constraint. Estimated costs are
                # disclosed as estimates; they are not used as fake venue-price evidence.
                if total_spent + stop_cost > budget:
                    continue
                if day_time + stop_time > hours_per_day:
                    continue

                arrival_hour = float(day_start_hour + day_time + travel_hr)
                hours_status = opening_hours_status(
                    place.get("opening_hours_raw"), weekday, visit_hour=arrival_hour
                )
                if hours_status == "closed":
                    continue

                relevance = float(place.get("recommendation_score", 0.0) or 0.0)
                distance_utility = 1.0 / (1.0 + road_km)
                utility = (0.80 * relevance) + (0.20 * distance_utility)
                feasible.append((utility, relevance, -road_km, idx, road_km, travel_hr, hours_status))

            if not feasible:
                break

            # Highest recommendation utility wins; deterministic tie-break favors
            # higher relevance and shorter distance.
            _, _, _, chosen_idx, road_km, travel_hr, hours_status = max(feasible)
            place = remaining.pop(chosen_idx)
            stop_time = travel_hr + float(place["total_time_hours"])
            stop_cost = float(place["estimated_cost"])
            day_time += stop_time
            total_spent += stop_cost

            itinerary.append({
                "day": day,
                "place": place["name"],
                "city": place.get("city", city),
                "place_type": place["place_type"],
                "estimated_cost": stop_cost,
                "cost_is_estimate": bool(place.get("cost_is_estimate", True)),
                "visit_duration_hours": float(place["visit_duration_hours"]),
                "travel_time_hours": round(float(travel_hr), 2),
                "travel_distance_km": round(float(road_km), 1),
                "travel_time_is_estimate": True,
                "route_method": "haversine_x_road_factor",
                "total_time_hours": round(float(stop_time), 2),
                "recommendation_score": place.get("recommendation_score", np.nan),
                "opening_hours_status": hours_status,
                "accessibility_status": place.get("accessibility_status", "unknown"),
                "latitude": place.get("latitude"),
                "longitude": place.get("longitude"),
                "source": place.get("source", place.get("_source")),
                "source_retrieved_at_utc": place.get("source_retrieved_at_utc"),
            })
            cursor = (place["latitude"], place["longitude"])

    return pd.DataFrame(itinerary)


# ============================================================
# EVALUATION (required by the plan: catalog coverage, intra-list
# diversity, itinerary feasibility. NDCG@5 and mean satisfaction need
# human relevance labels / real user ratings that this deployment
# doesn't collect, so those are reported as "not available" rather
# than approximated.)
# ============================================================

def eval_catalog_coverage(recommendations, catalog_pool):
    """Share of the retrieved candidate pool that made it into the
    final recommendation list."""
    if catalog_pool is None or catalog_pool.empty:
        return None
    shown = set(recommendations["name"]) if recommendations is not None and not recommendations.empty else set()
    pool_names = set(catalog_pool["name"])
    if not pool_names:
        return None
    return len(shown & pool_names) / len(pool_names)


def eval_intra_list_diversity(recommendations):
    """1 - (share of the list taken by the single most common place_type).
    Higher = more varied list."""
    if recommendations is None or recommendations.empty or "place_type" not in recommendations:
        return None
    counts = recommendations["place_type"].value_counts(normalize=True)
    return float(1.0 - counts.iloc[0]) if not counts.empty else None


def eval_itinerary_feasibility(itinerary):
    """Share of scheduled stops that satisfied every hard constraint this
    build enforces (opening hours confirmed-open-or-unknown, never
    confirmed-closed; accessibility confirmed-yes-or-unknown when
    required). Since violators are filtered before scheduling, this
    should read 1.0 for anything actually placed -- it's a sanity check,
    not an approximation."""
    if itinerary is None or itinerary.empty:
        return None
    ok = (itinerary["opening_hours_status"] != "closed").mean()
    return float(ok)


NDCG_UNAVAILABLE_NOTE = (
    "NDCG@5 requires human relevance labels, and mean user satisfaction requires "
    "real post-trip ratings -- neither is collected by this deployment, so both "
    "are reported as not available rather than estimated."
)


# ============================================================
# ASSISTANT / CHAT HELPERS
# ============================================================

def detect_intent(message):
    m = message.lower()
    if any(w in m for w in ["wheelchair", "accessible", "accessibility"]):
        return "accessibility"
    if any(w in m for w in ["budget", "cost", "price", "sar", "cheap", "expensive"]):
        return "budget"
    if any(w in m for w in ["hour", "time", "how long", "available"]):
        return "time"
    if any(w in m for w in ["remove", "skip", "don't want", "not interested in", "exclude", "closed"]):
        return "availability"
    if any(w in m for w in ["itinerary", "schedule", "plan", "day 1", "day plan"]):
        return "itinerary"
    if any(w in m for w in ["interest", "prefer", "like", "into"]):
        return "preferences"
    if any(w in m for w in ["recommend", "suggest", "places", "visit", "options"]):
        return "recommendation"
    return "general"


def extract_budget(message):
    match = re.search(r"(\d+(?:\.\d+)?)\s*(sar|riyal|ريال)?", message.lower())
    if match and ("sar" in message.lower() or "riyal" in message.lower() or "budget" in message.lower() or "ريال" in message):
        return float(match.group(1))
    return None


def extract_hours(message):
    match = re.search(r"(\d+(?:\.\d+)?)\s*(hour|hr|hours|ساعة|ساعات)", message.lower())
    if match:
        return float(match.group(1))
    return None


def extract_excluded_place(message, available_places):
    m = message.lower()
    if not any(w in m for w in ["remove", "skip", "not", "exclude", "don't", "closed"]):
        return None
    for place in available_places:
        if place.lower() in m:
            return place
    close = difflib.get_close_matches(m, [p.lower() for p in available_places], n=1, cutoff=0.6)
    if close:
        idx = [p.lower() for p in available_places].index(close[0])
        return available_places[idx]
    return None


def build_grounded_context(recommendations, itinerary, city):
    context = []
    if recommendations is not None and not recommendations.empty:
        for _, row in recommendations.iterrows():
            context.append({
                "name": row.get("name"),
                "city": row.get("city", city),
                "place_type": row.get("place_type"),
                "source": row.get("source", row.get("_source")),
                "retrieved_at_utc": row.get("source_retrieved_at_utc"),
                "estimates_used": bool(row.get("_estimates_used", False)),
            })
    if itinerary is not None and not itinerary.empty:
        for _, row in itinerary.iterrows():
            context.append({"name": row.get("place"), "day": row.get("day")})
    return context


def _freshness_note(context):
    """Surfaces retrieval timestamps and flags estimated fields, per the
    plan's grounding requirement -- never silently presents an estimate
    as a verified fact."""
    timestamps = [c["retrieved_at_utc"] for c in context if c.get("retrieved_at_utc")]
    notes = []
    if timestamps:
        try:
            latest = max(pd.Timestamp(t) for t in timestamps)
            age_min = max(0, int((pd.Timestamp.utcnow().tz_localize(None) - latest.tz_localize(None)).total_seconds() / 60))
            notes.append(f"(place data retrieved {age_min} min ago)")
        except Exception:
            pass
    if any(c.get("estimates_used") for c in context):
        notes.append("(cost/duration for some places are category-level estimates, not confirmed prices)")
    return " ".join(notes)


def process_assistant_message(message, state, recommendations=None, itinerary=None):
    intent = detect_intent(message)
    updated_state = dict(state)
    updated_state["excluded_places"] = list(state.get("excluded_places", []))

    extracted_budget = extract_budget(message)
    if extracted_budget is not None:
        updated_state["budget"] = extracted_budget

    extracted_hours = extract_hours(message)
    if extracted_hours is not None:
        updated_state["hours_per_day"] = extracted_hours

    excluded_place = None
    if recommendations is not None and not recommendations.empty:
        available_places = recommendations["name"].tolist()
        excluded_place = extract_excluded_place(message, available_places)

    if excluded_place is not None and excluded_place not in updated_state["excluded_places"]:
        updated_state["excluded_places"].append(excluded_place)

    return {"message": message, "intent": intent, "state": updated_state, "excluded_place": excluded_place}


def generate_assistant_response(user_message, assistant_result, recommendations=None, itinerary=None):
    state = assistant_result["state"]
    intent = assistant_result["intent"]
    context = build_grounded_context(recommendations=recommendations, itinerary=itinerary, city=state.get("city", "Saudi Arabia"))

    if intent == "budget":
        return (f"Your current trip budget is {float(state.get('budget') or 0):.0f} SAR. "
                f"The itinerary will prioritize options that fit within this budget.")

    if intent == "time":
        return (f"You currently have {float(state.get('hours_per_day') or 8.0):.1f} hours available per day. "
                f"The itinerary is generated using this time constraint.")

    if intent == "preferences":
        interests_str = ", ".join(state.get("interests", [])) if state.get("interests") else "General sightseeing"
        return (f"Your current interests are: {interests_str}. "
                f"Recommendations are ranked according to these preferences and verified tourism data.")

    if not context:
        return ("I could not find enough verified information in the current tourism data "
                "to answer this request. Please try another request based on the available "
                "destinations and recommendations.")

    if intent == "recommendation":
        places = list(dict.fromkeys(item["name"] for item in context if item.get("name")))
        if not places:
            return "No verified recommendations are currently available for this request."
        response = f"Based on the available tourism data for {state['city']}, here are suitable options:\n\n"
        for place in places[:5]:
            response += f"• {place}\n"
        response += "\nThese recommendations are based only on the current project dataset."
        note = _freshness_note(context)
        if note:
            response += f"\n{note}"
        return response

    if intent == "budget":
        return (f"Your current trip budget is {state['budget']:.0f} SAR. "
                f"The itinerary will prioritize options that fit within this budget.")

    if intent == "time":
        return (f"You currently have {state['hours_per_day']:.1f} hours available per day. "
                f"The itinerary is generated using this time constraint.")

    if intent == "availability":
        excluded = assistant_result["excluded_place"]
        if excluded:
            return (f"{excluded} has been marked as unavailable and can be removed from the itinerary. "
                    f"The system can generate an alternative plan.")
        return "I could not identify a specific place to remove from the current recommendations."

    if intent == "itinerary":
        if itinerary is None or itinerary.empty:
            return "There is currently no feasible itinerary available under the selected constraints."
        response = f"Your current {state['city']} itinerary contains {len(itinerary)} planned places.\n\n"
        for _, row in itinerary.iterrows():
            response += f"Day {int(row['day'])}: {row['place']} — {row['visit_duration_hours']:.1f} hours\n"
        return response

    if intent == "accessibility":
        if recommendations is None or recommendations.empty or "accessibility_status" not in recommendations:
            return "Accessibility data isn't available for the current recommendations."
        confirmed = (recommendations["accessibility_status"] == "yes").sum()
        unknown = (recommendations["accessibility_status"] == "unknown").sum()
        return (f"{confirmed} of {len(recommendations)} current recommendations have confirmed wheelchair "
                f"accessibility; {unknown} have no accessibility data reported by the source, so accessibility "
                f"there is unconfirmed rather than assumed.")

    if intent == "preferences":
        return ("Your current interests are: " + ", ".join(state["interests"])
                + ". Recommendations are ranked according to these preferences and the available tourism data.")

    return (f"I can help you plan your trip to {state['city']} using the available tourism "
            f"recommendations, budget, time, interests, and itinerary constraints.")


