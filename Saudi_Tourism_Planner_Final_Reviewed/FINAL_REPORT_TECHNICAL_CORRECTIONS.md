# Final Report — Technical Corrections Required Before Submission

This memo aligns the report with the hardened source code and the verified ML pipeline. It does **not** change the visual template; it lists factual corrections only.

## 1. Architecture / data sources

### Replace claims that Visit Saudi events and real navigation are already active
Current code keeps Visit Saudi integration optional and credential-gated. Without a legitimate configured API source, events are omitted rather than fabricated. Route distance/time are currently estimated using Haversine distance × a documented road factor and transport-speed assumptions.

**Use:**
> The system integrates live venue records through the team Places API/Geoapify, KAPSARC city-level and national tourism-sector demand context, and DataSaudi regional seasonality. Visit Saudi event integration is implemented as an optional credential-gated extension. The current itinerary prototype estimates route distance and travel time using Haversine distance with a road-distance factor and transport-mode speed assumptions; it does not claim real-time traffic routing.

## 2. Correct ML description

The project has **two different AI/data layers** and the report must not merge them:

1. **City-demand forecasting model:** Extra Trees regression trained on historical KAPSARC city-total POS values.
2. **Venue recommendation engine:** interpretable hybrid contextual ranker; it is not the Extra Trees model.

### Verified forecast model
- Problem: one-month-ahead monthly **city-total** POS demand forecasting.
- KAPSARC granularity: `Sectors == Total` and `City != Total` for city history.
- National tourism-sector context: `City == Total` for Hotels, Recreation and Culture, Restaurants & Café.
- KAPSARC does **not** provide an observed city × sector transaction cross in this supplied table.
- Selected model: `ExtraTreesRegressor(n_estimators=300, min_samples_leaf=2, max_features=1.0, random_state=42)` in a scikit-learn pipeline with one-hot encoding for city and median imputation for numeric features.
- Features: year, month, cyclical month encoding, trend index, lags 1/2/3/6/12, rolling means 3/6/12, rolling standard deviations 3/6/12.
- Model selection: three rolling-origin validation folds; primary metric MAE.
- Final holdout: July 2024 through June 2025.

### Verified final holdout results
| Metric | Extra Trees | Seasonal-naive baseline |
|---|---:|---:|
| MAE | 316,147.93 | 448,356.71 |
| RMSE | 791,073.74 | 926,580.06 |
| R² | 0.9803 | 0.9729 |
| MAPE | 6.88% | 10.17% |

MAE improvement vs seasonal-naive: **29.49%**.

### Recommendation ranking formula actually deployed
The recommendation ranker dynamically uses grounded available evidence with these weights:

- Preference match: 45%
- Place-record quality: 10%
- Regional demand context: 15%
- DataSaudi seasonality: 10%
- Distance fit: 20%

Regional demand context is derived as:

`0.4 × city_demand_score + 0.6 × national_tourism_sector_demand_score`

Budget and accessibility are not treated as fabricated ranking evidence. Estimated category costs are used only for itinerary feasibility, and strict accessibility accepts only confirmed accessibility evidence.

## 3. Endpoint names

The actual main endpoint is:

`POST /plan-trip`

Do not call it `/generate-trip`.

Additional hardened endpoints:
- `POST /predict-demand`
- `GET /health`
- `GET /model-info`
- `GET /api/dashboard/trending-places`

There is currently **no `/update-trip` endpoint** in the supplied final code. Do not describe swap/remove as a completed deployed endpoint unless the team implements and tests it before submission.

## 4. Frontend technology

The current interface is **React 18 + TypeScript + Tailwind CSS + Vite**, with Leaflet/OpenStreetMap for the results map.

Remove every statement saying the final web interface uses Streamlit.

## 5. User-preference handling

The frontend interests are mapped to supported Places API categories:
- Food → restaurants + cafes
- Culture & Heritage → attractions
- Nature → attractions
- Adventure → attractions
- Shopping → attraction retrieval + shopping keyword relevance
- Relaxation → attractions + cafes

The current recommender does **not** use cosine similarity between a trained user embedding and a place embedding. Describe it as explicit category/keyword preference matching.

## 6. Trending destinations

The source data does not contain a reliable per-venue visitor rating. The hardened API returns a transparent `trend_score`, not a star rating.

Do not write “based on visitor ratings.”

Use:
> Trending destinations are filtered to remove obvious geocoder/business noise and ranked using transparent distance, category-level affordability estimate, and landmark-name relevance signals. The trend score is not a visitor rating.

## 7. Budget, price, accessibility, and opening hours

- Venue-level prices are not available from the current normalized Places API.
- Costs shown to users are category-level estimates and are labeled `Est.`.
- Unknown accessibility is never converted to accessible.
- Strict accessibility mode accepts only confirmed evidence.
- Unknown opening hours stay unknown; confirmed-closed venues are excluded from scheduling.

Do not claim strict real venue-price optimization or complete opening-hours verification.

## 8. Routing wording

Do not write “dynamic navigation service” or “real-time route optimization” for the current implementation.

Use:
> The itinerary engine recomputes route legs from the actual previously scheduled stop using Haversine distance × a road-distance factor. Estimated travel time is obtained from transport-mode speed assumptions. A production routing provider can replace this approximation later.

## 9. Evaluation wording

Do not fabricate human-labeled NDCG or user-satisfaction metrics. The production pipeline has a validated historical forecast evaluation. Recommendation relevance still requires real human labels/user studies for a defensible final NDCG/user-satisfaction claim.

## 10. Recommended report framing

Use the phrase **“hybrid contextual recommendation engine + separately trained city-demand forecasting model”** consistently. This is the most accurate description of the final implementation.

## 11. Per-city forecast interpretation

The overall chronological holdout result is stronger than the seasonal-naive baseline, but this does **not** mean the ML model wins in every city. In the verified holdout, Makkah had a higher model MAE than the seasonal-naive baseline, while the other evaluated cities improved to varying degrees. Therefore, write that the model **outperformed the seasonal-naive baseline overall**, not that it outperformed it for every individual city.

Verified city-level MAE comparison is available in `metrics/city_level_holdout_mae.csv` from Drive run `20260907T143412Z`.
