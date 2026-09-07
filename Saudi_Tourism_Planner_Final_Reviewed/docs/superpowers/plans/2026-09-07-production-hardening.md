# Saudi Tourism Planner Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the ML data/model pipeline, integrate grounded demand artifacts into the FastAPI recommendation engine, fix backend/API correctness issues, and repair frontend integration bugs without redesigning the UI.

**Architecture:** Keep the existing React → FastAPI → recommendation/itinerary architecture. Replace the invalid KAPSARC city×sector assumption with two grounded signals: city-total POS demand and national tourism-sector POS demand. Train a leakage-safe city-demand forecast model separately for model evaluation/forecasting, while the recommender uses current observed city/sector demand context plus DataSaudi seasonality and live Places data. Keep unsupported price/accessibility evidence explicitly estimated/unknown.

**Tech Stack:** Python, pandas, scikit-learn, FastAPI, Pydantic, requests, React, TypeScript, Vite, Leaflet.

**Spec:** Current uploaded `saudi-trip-planner-fixed.zip`, current Samsung ML Drive artifacts, and the uploaded SIC Final Report.

## Global Constraints

- Preserve the existing frontend visual design and page structure.
- Do not fabricate venue ratings, prices, opening hours, accessibility, events, or route times.
- Use KAPSARC at the granularity it actually provides: city totals OR sector totals, not city×sector.
- Keep DataSaudi as regional/month seasonality context.
- Treat Geoapify/team Places API as the venue source of truth.
- Use chronological validation for demand forecasting and compare against seasonal-naive baseline.
- The web application must remain functional if the trained forecast model is missing; recommendation context artifacts are sufficient for graceful fallback.
- All public API inputs must be validated and errors must be structured.

---

### Task 1: Regression tests for known defects

**Files:**
- Create: `saudi-trip-planner-backend/tests/test_ml_engine.py`
- Create: `saudi-trip-planner-backend/tests/test_api.py`

**Interfaces:**
- Tests current interest mapping, accessibility semantics, route construction, trending score schema, and request validation.

- [ ] Write failing tests for UI-interest mapping (`Food`, `Culture & Heritage`, etc.).
- [ ] Run tests and verify failures are caused by missing/correctness behavior.
- [ ] Write failing tests proving strict accessibility must not treat unknown as confirmed accessible.
- [ ] Write failing test proving route leg distance is recomputed from the actual previous scheduled stop.
- [ ] Write failing API tests for budget/days validation and non-fabricated trending score.

### Task 2: Correct the ML data/model pipeline

**Files:**
- Create: `Saudi_Tourism_AI_ML_Production_Pipeline.ipynb`
- Generate artifacts consumed by backend.

**Interfaces:**
- Produces `city_demand_model.joblib`, `city_demand_context.csv`, `sector_demand_context.csv`, `datasaudi_seasonality_index.csv`, `kapsarc_city_monthly_features.csv`, `deployment_metadata.json`, metrics and reports.

- [ ] Filter KAPSARC indicator explicitly to transaction value.
- [ ] Build city monthly series only from `Sectors == Total` and non-total cities.
- [ ] Build national tourism-sector series only from `City == Total` and tourism sectors.
- [ ] Add lag/rolling/calendar features without leakage.
- [ ] Use rolling-origin validation to select ExtraTrees hyperparameters versus seasonal-naive.
- [ ] Evaluate the untouched chronological final holdout and store both model and baseline metrics.
- [ ] Build observed normalized city + sector demand context for recommendations.
- [ ] Preserve DataSaudi province/month seasonality context.
- [ ] Save all artifacts/results to Google Drive and generate a backend artifact bundle.

### Task 3: Backend ML/recommendation correctness

**Files:**
- Modify: `saudi-trip-planner-backend/ml_engine.py`

**Interfaces:**
- `map_interests_to_categories(interests) -> list[str]`
- `interest_match_score(row, user_interests) -> float`
- `recommend_places(...) -> DataFrame`
- `generate_itinerary(...) -> DataFrame`

- [ ] Resolve artifact paths relative to module directory.
- [ ] Load corrected city/sector context and optional forecast model once.
- [ ] Map product interests to supported venue categories and semantic keyword groups.
- [ ] Filter obvious noisy/duplicate venue records before ranking.
- [ ] Remove heuristic budget/accessibility from ranking weights when not grounded.
- [ ] Keep cost estimates for itinerary constraints but mark them as estimates.
- [ ] Make strict accessibility require confirmed evidence.
- [ ] Rework itinerary route loop so each leg is computed from actual prior scheduled stop and weekday advances per day.
- [ ] Preserve grounded source/timestamp/warning metadata.

### Task 4: FastAPI contract hardening

**Files:**
- Modify: `saudi-trip-planner-backend/main.py`
- Modify: `saudi-trip-planner-backend/requirements.txt`

**Interfaces:**
- `POST /plan-trip`
- `GET /health`
- `GET /model-info`
- `GET /api/dashboard/trending-places`

- [ ] Add Pydantic field bounds and transport validation.
- [ ] Configure CORS from environment with safe local defaults.
- [ ] Return recommendation/itinerary metadata and warnings without breaking existing frontend fields.
- [ ] Replace fake star rating with normalized `trend_score` and evidence basis.
- [ ] Add model-info/health details that reflect actual loaded artifacts.
- [ ] Keep current endpoint `/plan-trip` as canonical integration endpoint.

### Task 5: Frontend integration fixes without redesign

**Files:**
- Modify: `saudi-trip-planner-frontend/src/lib/api.ts`
- Modify: `saudi-trip-planner-frontend/src/lib/types.ts`
- Modify: `saudi-trip-planner-frontend/src/components/TrendingPlacesView.tsx`
- Modify: `saudi-trip-planner-frontend/src/components/PlaceCard.tsx`
- Modify: `saudi-trip-planner-frontend/src/pages/Results.tsx`
- Optionally modify `Plan.tsx` only for validation/accessibility input if needed while preserving styles.

- [ ] Replace hardcoded trending localhost with shared `VITE_API_BASE` behavior.
- [ ] Parse backend error details.
- [ ] Stop representing trending score as visitor rating/star rating.
- [ ] Label costs as estimates.
- [ ] Preserve the existing visual layout/classes.
- [ ] Ensure TypeScript build passes.

### Task 6: Full-system verification and packaging

**Files:**
- Create backend tests and verification report.
- Package final source ZIP.

- [ ] Run backend unit/API tests.
- [ ] Run Python compile checks.
- [ ] Run frontend `npm run build`.
- [ ] Run FastAPI smoke tests with mocked Places upstream and real local artifacts.
- [ ] Verify model artifact can load and predict finite values.
- [ ] Verify recommendation responses contain only grounded venue rows and no fake ratings.
- [ ] Zip the entire corrected project and provide the corrected notebook separately.
