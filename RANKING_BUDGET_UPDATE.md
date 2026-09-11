# Ranking + Budget Update

Implemented:
- Personalized ranking now includes `budget_fit` as a 20% ranking signal.
- Ranking weights: preference 40%, budget fit 20%, place quality 10%, regional demand 10%, seasonality 10%, distance fit 10%.
- Added per-place `rank`, `ranking_score`, `budget_fit`, `budget_difference`, and `budget_status` to the API response.
- Frontend place cards display the ranking number and budget-fit percentage.
- The itinerary generator continues to enforce the total trip budget as a hard constraint.
- Budget values remain clearly labeled as estimates where venue-level verified prices are unavailable.

Validation:
- Backend pytest: 36 passed.
- Frontend build was not run because `node_modules` is not present in the uploaded project.
