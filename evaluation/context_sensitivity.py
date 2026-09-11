"""Context-sensitivity evaluation for presentation evidence.

Runs the deployed FastAPI planning logic directly without starting a server.
It verifies that user inputs (budget, interests, transport, month, city, days)
change score components and itinerary feasibility transparently.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "saudi-trip-planner-backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import main  # noqa: E402

# Keep the evaluation deterministic and fast for presentation evidence.
main.get_exact_place_photo = lambda *args, **kwargs: None
main._wikipedia_photo = lambda *args, **kwargs: None


OUTPUT = Path(__file__).resolve().parent / "context_sensitivity_results.csv"

BASE: dict[str, Any] = {
    "city": "Riyadh",
    "budget": 1000,
    "days": 3,
    "interests": ["Culture & Heritage", "Food", "Nature"],
    "transport_mode": "driving",
    "require_accessibility": False,
    "trip_month": 9,
}

cases: list[dict[str, Any]] = []

for budget in [200, 300, 500, 1000, 10000]:
    case = dict(BASE, axis="budget", case_value=str(budget), budget=budget)
    cases.append(case)

interest_profiles = {
    "culture": ["Culture & Heritage"],
    "food": ["Food"],
    "nature": ["Nature"],
    "mixed": ["Culture & Heritage", "Food", "Nature"],
}
for name, interests in interest_profiles.items():
    cases.append(dict(BASE, axis="interests", case_value=name, interests=interests))

for transport in ["walking", "public_transit", "driving"]:
    cases.append(dict(BASE, axis="transport", case_value=transport, transport_mode=transport))

for month in [1, 4, 7, 10]:
    cases.append(dict(BASE, axis="month", case_value=str(month), trip_month=month))

for city in ["Riyadh", "Makkah", "Madinah", "Jeddah", "Abha"]:
    cases.append(dict(BASE, axis="city", case_value=city, city=city))

for days in [1, 3, 5]:
    cases.append(dict(BASE, axis="days", case_value=str(days), days=days))

for acc in [False, True]:
    cases.append(dict(BASE, axis="accessibility", case_value="strict" if acc else "standard", require_accessibility=acc))

rows = []

for case in cases:
    payload = {k: v for k, v in case.items() if k not in {"axis", "case_value"}}
    req = main.PlanTripRequest(**payload)
    data = main.plan_trip(req)
    places = data.get("places", [])
    meta = data.get("metadata", {})
    top5 = places[:5]

    def avg(field: str):
        vals = [float(p.get(field, 0) or 0) for p in top5]
        return round(sum(vals) / len(vals), 4) if vals else None

    rows.append({
        "axis": case["axis"],
        "case_value": case["case_value"],
        "city": payload["city"],
        "budget": payload["budget"],
        "days": payload["days"],
        "interests": " | ".join(payload["interests"]),
        "transport": payload["transport_mode"],
        "month": payload["trip_month"],
        "top_5_places": " | ".join(p.get("name", "") for p in top5),
        "top_5_categories": " | ".join(str(p.get("category", "")) for p in top5),
        "avg_preference_match": avg("preference_match"),
        "avg_budget_fit": avg("budget_fit"),
        "avg_travel_fit": avg("distance_fit"),
        "avg_seasonality": avg("seasonality"),
        "estimated_total_cost": meta.get("estimated_total_cost"),
        "remaining_budget": meta.get("remaining_budget"),
        "budget_utilization_pct": meta.get("budget_utilization_pct"),
        "scheduled_stops": meta.get("scheduled_stops"),
        "budget_constraint_status": meta.get("budget_constraint_status"),
    })

out = pd.DataFrame(rows)
out.to_csv(OUTPUT, index=False)
print(out.to_string(index=False))
print(f"\nSaved to: {OUTPUT}")
