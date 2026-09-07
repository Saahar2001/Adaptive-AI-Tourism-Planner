from fastapi.testclient import TestClient

import main
import ml_engine as eng


def _fake_upstream(city: str, category: str, limit: int):
    center = eng.CITY_CENTERS[city]
    names = {
        "attractions": "National Museum",
        "restaurants": "Heritage Restaurant",
        "cafes": "Garden Cafe",
    }
    return [
        {
            "name": names[category],
            "latitude": center[0] + 0.005,
            "longitude": center[1] + 0.005,
            "category": {
                "attractions": "tourism.attraction",
                "restaurants": "catering.restaurant",
                "cafes": "catering.cafe",
            }[category],
            "address": f"{city}, Saudi Arabia",
            "city": city,
            "country": "Saudi Arabia",
            "opening_hours": "24/7",
            "place_id": f"{city.lower()}-{category}-1",
            "requested_city": city,
            "requested_category": category,
            "source": "test-grounded-upstream",
            "source_retrieved_at_utc": "2026-09-07T00:00:00+00:00",
        }
    ]


def test_health_and_model_info_contracts():
    with TestClient(main.app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        payload = health.json()
        assert payload["status"] == "ok"
        assert payload["recommendation_context_loaded"] is True
        assert payload["forecast_model_loaded"] is True

        info = client.get("/model-info")
        assert info.status_code == 200
        model_info = info.json()
        assert model_info["recommendation_context"]["available"] is True
        assert model_info["forecast_model"]["available"] is True
        assert model_info["kapsarc_granularity"]["observed_city_sector_cross"] == "not available in source"


def test_predict_demand_endpoint_returns_finite_grounded_forecast():
    with TestClient(main.app) as client:
        response = client.post("/predict-demand", json={"city": "Riyadh"})
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["city"] == "Riyadh"
        assert payload["forecast_month"] == "2025-07"
        assert payload["predicted_transaction_value_thousand_sar"] > 0
        assert payload["seasonal_naive_baseline"] > 0
        assert payload["model_version"]


def test_predict_demand_does_not_substitute_an_uncovered_city():
    with TestClient(main.app) as client:
        response = client.post("/predict-demand", json={"city": "AlUla"})
        assert response.status_code == 422
        assert "not available" in response.json()["detail"].lower()


def test_plan_trip_food_interest_retrieves_only_food_categories(monkeypatch):
    monkeypatch.setattr(eng, "_fetch_places_from_upstream", _fake_upstream)
    with TestClient(main.app) as client:
        response = client.post(
            "/plan-trip",
            json={
                "city": "Madinah",
                "budget": 500,
                "days": 1,
                "interests": ["Food"],
                "transport_mode": "driving",
                "require_accessibility": False,
                "trip_month": 9,
            },
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["places"]
        assert {p["category"] for p in payload["places"]} <= {"restaurant", "cafe"}
        assert all(p["source"] == "test-grounded-upstream" for p in payload["places"])
        assert payload["metadata"]["forecast_model_used_for_ranking"] is False
        assert "city-total" in payload["metadata"]["regional_context"]


def test_strict_accessibility_returns_no_unknown_accessibility_places(monkeypatch):
    monkeypatch.setattr(eng, "_fetch_places_from_upstream", _fake_upstream)
    with TestClient(main.app) as client:
        response = client.post(
            "/plan-trip",
            json={
                "city": "Riyadh",
                "budget": 500,
                "days": 1,
                "interests": ["Culture & Heritage"],
                "transport_mode": "walking",
                "require_accessibility": True,
                "trip_month": 9,
            },
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["places"] == []
        assert payload["itinerary"] == []
        assert any("confirmed accessibility" in w.lower() for w in payload["warnings"])


def test_plan_trip_rejects_invalid_city_and_trip_month():
    with TestClient(main.app) as client:
        bad_city = client.post("/plan-trip", json={"city": "London", "budget": 100, "days": 1})
        assert bad_city.status_code == 422

        bad_month = client.post(
            "/plan-trip",
            json={"city": "Riyadh", "budget": 100, "days": 1, "trip_month": 13},
        )
        assert bad_month.status_code == 422


def test_predict_demand_response_is_self_describing():
    with TestClient(main.app) as client:
        response = client.post('/predict-demand', json={'city': 'Riyadh'})
        assert response.status_code == 200
        payload = response.json()
        assert payload['forecast_horizon_months'] == 1
        assert payload['target'] == 'monthly city-total POS transaction value'
        assert payload['unit'] == 'thousand SAR'
