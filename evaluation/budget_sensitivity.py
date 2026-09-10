"""Evaluate recommendation and itinerary behavior across representative budgets."""

import csv
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "saudi-trip-planner-backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main
import ml_engine as eng


ALL_INTERESTS = ["Culture & Heritage", "Food", "Nature", "Adventure", "Shopping", "Relaxation"]
CASES = (200, 300, 500, 1000, 10000)


def evaluate():
    rows = []
    for budget in CASES:
        result = main.plan_trip(main.PlanTripRequest(
            city="Riyadh",
            budget=budget,
            days=3,
            interests=ALL_INTERESTS,
            transport_mode="driving",
            trip_month=9,
        ))
        metadata = result["metadata"]
        fits = [place["budget_fit"] for place in result["places"]]
        row = {
            "Budget": budget,
            "Top Places": " | ".join(place["name"] for place in result["places"][:5]),
            "Estimated Total Cost": metadata["estimated_total_cost"],
            "Scheduled Stops": len(result["itinerary"]),
            "Average Budget Fit": round(sum(fits) / len(fits), 4) if fits else 0.0,
            "Budget Constraint Status": metadata["budget_constraint_status"],
        }
        rows.append(row)

    output = Path(__file__).resolve().parent / "budget_sensitivity_results.csv"
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print("Budget | Top Places | Estimated Total Cost | Scheduled Stops | Average Budget Fit | Budget Constraint Status")
    for row in rows:
        print(" | ".join(str(value) for value in row.values()))
    print(f"Saved {output}")


if __name__ == "__main__":
    evaluate()