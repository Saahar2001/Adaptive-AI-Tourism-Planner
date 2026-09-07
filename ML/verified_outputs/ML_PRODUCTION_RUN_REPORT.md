# Saudi Tourism Planner — Production ML Run

Run ID: 20260907T143412Z
Generated UTC: 2026-09-07T14:34:55.644416+00:00

## KAPSARC
- Raw rows: 31,262
- Value-indicator rows: 7,830
- Complete city-month rows: 620
- Complete city history through: 2025-06-01
- City × sector observed cross: NOT available in the source table

## Forecast model
- Selected: ExtraTrees(n=300,leaf=2,max_features=1.0)
- Rolling validation MAE: 374657.77
- Rolling validation improvement vs seasonal-naive: 31.32%
- Holdout MAE: 316147.93
- Holdout RMSE: 791073.74
- Holdout R²: 0.9803
- Holdout MAPE: 6.88%
- Holdout MAE improvement vs seasonal-naive: 29.49%

## Recommendation context
- City demand context rows: 10
- National tourism-sector context rows: 3
- DataSaudi seasonality rows: 168

## Scientific integrity
- Venue price is not claimed as verified; itinerary cost is estimated.
- Unknown accessibility is not treated as confirmed accessible.
- Unknown opening hours are not treated as confirmed open.
- Routing is an explicit estimate unless a real routing provider is integrated.
- Human relevance / satisfaction metrics require real user labels and are not fabricated.