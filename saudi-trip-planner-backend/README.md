# Saudi Tourism Planner — FastAPI Backend

Production-hardened backend for the Adaptive AI Tourism Planner. The React client calls this service; the service retrieves grounded venue records from the team's Places API, enriches them with KAPSARC/DataSaudi context, ranks them with an interpretable hybrid recommender, and builds a constraint-aware itinerary.

## Architecture

```text
React / TypeScript frontend
        ↓
FastAPI (`/plan-trip`)
        ↓
Hybrid contextual recommender
  ├─ Live Places API / Geoapify venue records
  ├─ KAPSARC city-total demand context
  ├─ KAPSARC national tourism-sector context
  ├─ DataSaudi province/month seasonality
  └─ preference + distance + record-quality signals
        ↓
Constraint-aware itinerary generator
        ↓
JSON response for React + Leaflet
```

A separately trained one-month-ahead **city-total POS demand forecast model** is exposed through `/predict-demand`. It is evaluated and versioned, but it is **not falsely presented as the venue-ranking model**. Recommendations use the grounded contextual artifacts listed above.

## Install and run

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Swagger: `http://localhost:8000/docs`

## Environment variables

```text
PLACES_API_BASE=https://placesproject.onrender.com
FRONTEND_ORIGINS=http://localhost:5173,http://localhost:3000
HTTP_TIMEOUT_SECONDS=12
CACHE_TTL_SECONDS=900
GOOGLE_PLACES_API_KEY=                 # optional, exact-place photos only
VISIT_SAUDI_API_BASE=                  # optional; events stay disabled without a legitimate source
VISIT_SAUDI_API_KEY=                   # optional
```

## Public API

### `POST /plan-trip`

```json
{
  "city": "Madinah",
  "budget": 1500,
  "days": 3,
  "interests": ["Culture & Heritage", "Food"],
  "transport_mode": "driving",
  "require_accessibility": false,
  "trip_month": 9
}
```

The response includes `places`, a flat backend itinerary that the frontend groups by day, `warnings`, and transparent metadata. Venue prices and travel times are explicitly marked as estimates where the current sources do not provide verified values.

### `POST /predict-demand`

Returns a one-month-ahead **city-total KAPSARC POS** forecast for cities covered by the training series. `AlUla` intentionally returns a validation error because KAPSARC does not provide an AlUla city-total series in the current source; the API does not substitute Madinah and pretend it is AlUla.

### `GET /model-info`

Reports the deployed model version, evaluation metrics, KAPSARC granularity, ranking context, and limitations.

### `GET /health`

Reports service health, recommendation-context availability, and forecast-model availability.

### `GET /api/dashboard/trending-places`

Returns a transparent `trend_score` based on available contextual/location fields. It is **not a visitor rating** and no fabricated star rating is returned.

## Grounding and constraints

- KAPSARC does **not** expose an observed city × sector cross in the supplied table. The pipeline therefore models city totals separately and derives national tourism-sector context separately.
- DataSaudi supplies province/month accommodation occupancy seasonality.
- The current normalized Places API does not reliably expose venue-level prices or accessibility. Costs are category-level estimates; strict accessibility accepts only confirmed evidence.
- Sparse or unknown opening hours remain `unknown`; they are never promoted to confirmed-open.
- Routing currently uses Haversine distance × a documented road factor with transport-speed assumptions. It is not real-time traffic routing.
- Human-labeled NDCG and user satisfaction are not fabricated; they require a real evaluation study.

## Tests

```bash
pip install -r requirements-dev.txt
pytest -q
python -m compileall -q .
```
