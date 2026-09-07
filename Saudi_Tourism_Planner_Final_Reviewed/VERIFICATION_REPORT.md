# Final Verification Report — Saudi Tourism Planner

Verified against Google Drive production run `20260907T143412Z` and the hardened source bundle.

## Drive artifacts inspected

The production run contains the required deployment artifacts:

- `city_demand_model.joblib`
- `kapsarc_city_monthly_features.csv`
- `kapsarc_sector_monthly_features.csv`
- `city_demand_context.csv`
- `sector_demand_context.csv`
- `datasaudi_seasonality_index.csv`
- `city_demand_metrics.json`
- `deployment_metadata.json`

The model artifact in Drive is ~9.4 MB and is copied into `saudi-trip-planner-backend/ml_artifacts/` in this bundle.

## Verified model

Selected model: `ExtraTrees(n=300,leaf=2,max_features=1.0)`.

Rolling-origin validation:
- Mean MAE: 374,657.77 thousand SAR
- Mean MAPE: 10.13%
- Seasonal-naive mean MAE: 545,498.63 thousand SAR
- MAE improvement vs baseline: 31.32%

Untouched chronological holdout (2024-07 through 2025-06):
- MAE: 316,147.93 thousand SAR
- RMSE: 791,073.74 thousand SAR
- R²: 0.9803
- MAPE: 6.88%
- Seasonal-naive MAE: 448,356.71 thousand SAR
- Seasonal-naive MAPE: 10.17%
- MAE improvement vs baseline: 29.49%

The overall model outperforms the seasonal-naive baseline, but it is not claimed to outperform the baseline in every individual city. The saved city-level holdout file shows Makkah as the main exception in this holdout.

## Forecast smoke outputs

The Drive run produced finite July 2025 forecasts for all KAPSARC-covered city series used by the training pipeline: Abha, Buraidah, Dammam, Hail, Jeddah, Khobar, Madinah, Makkah, Riyadh, and Tabuk.

`AlUla` remains supported by the recommendation planner, but `/predict-demand` returns HTTP 422 for AlUla because the current KAPSARC city-total training table has no AlUla series. The system does not silently substitute another city.

## Ten review passes

1. **Drive artifact completeness:** PASS — all required production inference artifacts present.
2. **Model serialization/load:** PASS — copied Drive `.joblib` loads through the backend and produces finite predictions.
3. **KAPSARC granularity:** PASS — city-total and national-sector cuts are kept separate; no fabricated observed city×sector spending.
4. **Temporal evaluation:** PASS — rolling-origin model selection plus untouched 12-month chronological holdout; incomplete latest month excluded.
5. **Model-vs-baseline evaluation:** PASS — selected model beats seasonal-naive overall on validation and final holdout.
6. **Backend unit/integration suite:** PASS — 23 backend tests in the final suite, including model, API, routing, accessibility, seasonality mapping, fallback behavior, and response contracts.
7. **Backend compilation:** PASS — Python `compileall` completes without syntax errors.
8. **Frontend regression suite:** PASS — 8 source-contract tests covering API base, trend-score truthfulness, estimated costs, accessibility, travel month, available-category handling, timeout handling, and empty trending state.
9. **Frontend TS/TSX parse/transpile check:** PASS — all 11 TypeScript/TSX source files parse/transpile successfully with TypeScript 5.8.3.
10. **Package/config consistency:** PASS — `package.json` dependencies and devDependencies match the root of `package-lock.json` (lockfile v3); environment-specific API URLs are centralized.

## API smoke verification with the real Drive model artifact

- `GET /health` → 200; recommendation context loaded; forecast model loaded.
- `GET /model-info` → 200; exposes model version, final holdout metrics, KAPSARC granularity, ranking weights, and limitations.
- `POST /predict-demand {"city":"Riyadh"}` → 200; one-month forecast for `2025-07` plus seasonal-naive baseline and model version.
- `POST /predict-demand {"city":"AlUla"}` → 422; no false city substitution.

## Frontend production-build note

The source passes frontend regression tests and TS/TSX syntax transpilation. A full `npm run build` could not be completed inside this execution container because the copied `node_modules` directory contained empty package directories and the environment could not resolve `registry.npmjs.org` while running `npm ci`. The final ZIP intentionally excludes `node_modules`; on a normal networked environment, run `npm ci && npm run build` using the included lockfile.

This network/package-install limitation is not represented as a successful production build.
