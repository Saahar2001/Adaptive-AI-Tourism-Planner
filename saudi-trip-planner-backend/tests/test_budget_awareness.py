import pandas as pd
import pytest
from fastapi.testclient import TestClient

import main
import ml_engine as eng


ALL_INTERESTS = [
    "Culture & Heritage",
    "Food",
    "Nature",
    "Adventure",
    "Shopping",
    "Relaxation",
]


def _budget_upstream(city: str, category: str, limit: int):
    center = eng.CITY_CENTERS[city]
    names = {
        "attractions": "Riyadh Museum",
        "restaurants": "Riyadh Restaurant",
        "cafes": "Riyadh Cafe",
    }
    category_names = {
        "attractions": "tourism.attraction",
        "restaurants": "catering.restaurant",
        "cafes": "catering.cafe",
    }
    return [{
        "name": names[category],
        "latitude": center[0] + 0.001,
        "longitude": center[1] + 0.001,
        "category": category_names[category],
        "address": f"{city}, Saudi Arabia",
        "city": city,
        "opening_hours": "24/7",
        "place_id": f"{city}-{category}",
        "requested_city": city,
        "requested_category": category,
        "source": "budget-test",
        "source_retrieved_at_utc": "2026-09-09T00:00:00Z",
    }]


def _plan(client, budget: float):
    response = client.post("/plan-trip", json={
        "city": "Riyadh",
        "budget": budget,
        "days": 3,
        "interests": ALL_INTERESTS,
        "transport_mode": "driving",
        "trip_month": 9,
    })
    assert response.status_code == 200, response.text
    return response.json()


def test_budget_matrix_exposes_normalized_score_breakdown_and_estimate_metadata(monkeypatch):
    monkeypatch.setattr(eng, "_fetch_places_from_upstream", _budget_upstream)
    with TestClient(main.app) as client:
        results = {budget: _plan(client, budget) for budget in (200, 500, 1000, 10000)}

    for budget, payload in results.items():
        assert payload["metadata"]["budget_constraint_status"] in {
            "binding", "partially_binding", "non_binding"
        }
        assert payload["metadata"]["costs_are_category_estimates"] is True
        assert payload["metadata"]["estimated_places_capacity"] == 12
        assert payload["metadata"]["estimated_per_stop_allowance"] == pytest.approx(budget / 12)
        assert payload["metadata"]["recommendation_weights"]["budget_fit"] == pytest.approx(0.20)
        assert payload["metadata"]["budget_estimate_basis"]
        assert sum(payload["metadata"]["recommendation_weights"].values()) == pytest.approx(1.0)
        for place in payload["places"]:
            for key in (
                "recommendation_score", "preference_match", "place_quality",
                "regional_demand", "seasonality", "distance_fit", "budget_fit",
            ):
                assert key in place
                assert 0.0 <= place[key] <= 1.0
            assert place["cost_is_estimate"] is True

        estimated_total = sum(stop["estimated_cost"] for stop in payload["itinerary"])
        assert estimated_total <= budget + 1e-9
        assert payload["metadata"]["estimated_total_cost"] == pytest.approx(estimated_total)
        assert payload["metadata"]["remaining_budget"] == pytest.approx(budget - estimated_total)
        assert 0.0 <= payload["metadata"]["budget_utilization_pct"] <= 100.0

    low = results[200]["places"]
    by_category = {place["category"]: place["budget_fit"] for place in low}
    assert by_category["restaurant"] < by_category["attraction"] < by_category["cafe"]

    for budget in (200, 500, 1000, 10000):
        names = {place["name"]: place["budget_fit"] for place in results[budget]["places"]}
        if budget < 10000:
            assert all(names[name] <= results[10000]["places"][i]["budget_fit"] for i, name in enumerate(names))

    assert [p["name"] for p in results[1000]["places"]] == [p["name"] for p in results[10000]["places"]]


def test_budget_fit_is_affordability_and_monotonic():
    assert eng.calculate_budget_fit(80, 200, 3) < eng.calculate_budget_fit(50, 200, 3)
    assert eng.calculate_budget_fit(80, 1000, 3) <= eng.calculate_budget_fit(80, 10000, 3)
    assert all(0.0 <= eng.calculate_budget_fit(80, budget, 3) <= 1.0 for budget in (200, 500, 1000, 10000))


def test_itinerary_never_exceeds_budget():
    recommendations = pd.DataFrame([
        {
            "name": "Expensive stop",
            "city": "Riyadh",
            "place_type": "restaurant",
            "estimated_cost": 80.0,
            "cost_is_estimate": True,
            "visit_duration_hours": 1.0,
            "total_time_hours": 1.0,
            "recommendation_score": 1.0,
            "opening_hours_raw": None,
            "accessibility_status": "unknown",
            "latitude": 24.7136,
            "longitude": 46.6753,
        },
    ])
    itinerary = eng.generate_itinerary(recommendations, budget=50, days=1, hours_per_day=8, city="Riyadh")
    assert itinerary.empty or itinerary["estimated_cost"].sum() <= 50
