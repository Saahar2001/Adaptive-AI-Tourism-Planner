# Saudi Tourism Planner — Frontend

React 18 + TypeScript + Tailwind CSS + Vite. The visual design and page structure are intentionally preserved while the integration contract is hardened.

```text
Home
  → Trip preferences (destination, budget, days, travel month, interests, transport, accessibility)
  → POST /plan-trip
  → Results (day tabs, recommendations, estimated costs, Leaflet map)
  → Modify plan
```

## Install

```bash
npm ci
```

## Configure the backend

```bash
cp .env.example .env
```

Set:

```text
VITE_API_BASE=http://localhost:8000
```

Use the deployed FastAPI URL in production. Do not hardcode an environment-specific URL in components.

## Run

```bash
npm run dev
```

Production build:

```bash
npm run build
```

## API contract

The frontend uses `src/lib/api.ts` as the single API adapter and calls:

```http
POST /plan-trip
GET  /api/dashboard/trending-places
```

Example trip request:

```json
{
  "city": "Madinah",
  "budget": 1500,
  "days": 3,
  "trip_month": 9,
  "interests": ["Culture & Heritage", "Food"],
  "transport_mode": "driving",
  "require_accessibility": false
}
```

The adapter also normalizes backend numeric fields, groups the backend's flat itinerary rows by day, exposes backend warnings, and preserves source/evidence metadata.

## Truthful UI semantics

- Costs are displayed as `Est.` because the current normalized Places API does not provide reliable venue-level prices.
- Trending destinations display a transparent `trend_score`, not a fabricated visitor/star rating.
- The selected travel month is sent to the backend so DataSaudi seasonality is evaluated for the intended trip month.
- Strict accessibility is sent to the backend. Places with unknown accessibility are not represented as confirmed accessible.
- The Leaflet map uses free OpenStreetMap tiles and plots only places with real coordinates returned by the backend.

## Notes

- The landing-page Saudi map (`src/components/SaudiMap.tsx`) remains a stylized decorative graphic; it is not used as geospatial evidence.
- Styling tokens remain in `tailwind.config.js`. The production-hardening changes do not redesign the existing UI.
