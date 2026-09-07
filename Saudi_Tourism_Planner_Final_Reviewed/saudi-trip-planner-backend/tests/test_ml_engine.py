from pathlib import Path

import pandas as pd
import pytest

import ml_engine as eng


def test_artifact_root_is_module_relative_absolute_path():
    assert eng.ARTIFACT_ROOT.is_absolute()
    assert eng.ARTIFACT_ROOT.parent == Path(eng.__file__).resolve().parent


def test_food_interest_maps_to_restaurants_and_cafes_only():
    assert eng.map_interests_to_categories(["Food"]) == ["restaurants", "cafes"]


def test_culture_and_nature_map_to_attractions():
    assert eng.map_interests_to_categories(["Culture & Heritage", "Nature"]) == ["attractions"]


def test_empty_interests_retrieve_all_supported_categories():
    assert eng.map_interests_to_categories([]) == ["attractions", "restaurants", "cafes"]


def test_food_preference_scores_food_venues_above_attractions():
    restaurant = pd.Series({
        "requested_category": "restaurants",
        "name": "Test Restaurant",
        "address": "Riyadh",
        "category": "catering",
    })
    attraction = pd.Series({
        "requested_category": "attractions",
        "name": "Historic Museum",
        "address": "Riyadh",
        "category": "tourism",
    })
    assert eng.interest_match_score(restaurant, ["Food"]) > eng.interest_match_score(attraction, ["Food"])


def test_strict_accessibility_does_not_schedule_unknown_accessibility():
    recommendations = pd.DataFrame([
        {
            "name": "Unknown accessibility place",
            "city": "Riyadh",
            "place_type": "attraction",
            "estimated_cost": 10.0,
            "visit_duration_hours": 1.0,
            "total_time_hours": 1.0,
            "recommendation_score": 0.9,
            "opening_hours_raw": None,
            "accessibility_status": "unknown",
            "latitude": 24.7136,
            "longitude": 46.6753,
        }
    ])
    itinerary = eng.generate_itinerary(
        recommendations,
        budget=100,
        days=1,
        hours_per_day=8,
        city="Riyadh",
        require_accessibility=True,
    )
    assert itinerary.empty


def test_route_distance_is_recomputed_from_actual_previous_scheduled_stop():
    center = eng.CITY_CENTERS["Riyadh"]
    # A is nearest to the center but too expensive, so it must be skipped.
    # B is then the first scheduled stop. Its leg must be center -> B, not A -> B.
    recommendations = pd.DataFrame([
        {
            "name": "A skipped",
            "city": "Riyadh",
            "place_type": "attraction",
            "estimated_cost": 1000.0,
            "visit_duration_hours": 1.0,
            "total_time_hours": 1.0,
            "recommendation_score": 1.0,
            "opening_hours_raw": None,
            "accessibility_status": "unknown",
            "latitude": center[0],
            "longitude": center[1] - 0.03,
        },
        {
            "name": "B scheduled",
            "city": "Riyadh",
            "place_type": "attraction",
            "estimated_cost": 10.0,
            "visit_duration_hours": 1.0,
            "total_time_hours": 1.0,
            "recommendation_score": 0.9,
            "opening_hours_raw": None,
            "accessibility_status": "unknown",
            "latitude": center[0],
            "longitude": center[1] + 0.05,
        },
    ])
    itinerary = eng.generate_itinerary(
        recommendations,
        budget=100,
        days=1,
        hours_per_day=8,
        city="Riyadh",
        require_accessibility=False,
    )
    assert list(itinerary["place"]) == ["B scheduled"]
    expected_road_km = eng._haversine_km(center[0], center[1], center[0], center[1] + 0.05) * eng.ROUTE_DISTANCE_FACTOR
    assert itinerary.iloc[0]["travel_distance_km"] == pytest.approx(expected_road_km, abs=0.2)


def test_obvious_junk_attraction_is_filtered_but_landmark_is_kept():
    rows = [
        {
            "name": "Bazy Trading",
            "latitude": 24.7,
            "longitude": 46.6,
            "category": "tourism",
            "address": "Riyadh",
            "city": "Riyadh",
            "opening_hours": None,
            "place_id": "junk",
            "requested_city": "Riyadh",
            "requested_category": "attractions",
            "source": "test",
            "source_retrieved_at_utc": "2026-01-01T00:00:00Z",
        },
        {
            "name": "National Museum",
            "latitude": 24.7,
            "longitude": 46.6,
            "category": "tourism",
            "address": "Riyadh",
            "city": "Riyadh",
            "opening_hours": None,
            "place_id": "good",
            "requested_city": "Riyadh",
            "requested_category": "attractions",
            "source": "test",
            "source_retrieved_at_utc": "2026-01-01T00:00:00Z",
        },
    ]
    prepared = eng._prepare_places(rows)
    assert "Bazy Trading" not in set(prepared["name"])
    assert "National Museum" in set(prepared["name"])


def test_datasaudi_province_aliases_match_deployed_artifact_keys():
    artifacts = eng._load_ml_artifacts()
    assert artifacts is not None
    keys = set(artifacts["seasonality"]["province_key"].astype(str).map(eng._normalize_text))
    for city in ["Riyadh", "Abha", "Dammam", "Tabuk", "Jeddah", "Makkah", "Madinah"]:
        mapped = eng.CITY_TO_PROVINCE[eng._normalize_text(city)]
        assert any(mapped in key for key in keys), (city, mapped, sorted(keys))


def test_local_fallback_respects_food_interest_categories(monkeypatch):
    def fail_upstream(*args, **kwargs):
        raise eng.requests.RequestException("offline")

    monkeypatch.setattr(eng, "_fetch_places_from_upstream", fail_upstream)
    local = pd.DataFrame([
        {
            "city": "Riyadh", "name": "Local Museum", "place_type": "attraction",
            "estimated_cost": 50.0, "distance_score": 0.8, "popularity_score": 0.5,
            "latitude": 24.71, "longitude": 46.67,
        },
        {
            "city": "Riyadh", "name": "Local Restaurant", "place_type": "restaurant",
            "estimated_cost": 80.0, "distance_score": 0.7, "popularity_score": 0.5,
            "latitude": 24.72, "longitude": 46.68,
        },
        {
            "city": "Riyadh", "name": "Local Cafe", "place_type": "cafe",
            "estimated_cost": 35.0, "distance_score": 0.6, "popularity_score": 0.5,
            "latitude": 24.73, "longitude": 46.69,
        },
    ])
    result = eng.recommend_places("Riyadh", ["Food"], features_df=local, top_n=10)
    assert set(result["place_type"]) == {"restaurant", "cafe"}


def test_live_recommendations_keep_successful_categories_when_one_upstream_call_fails(monkeypatch):
    center = eng.CITY_CENTERS["Riyadh"]

    def partial_upstream(city, category, limit):
        if category == "restaurants":
            raise eng.requests.RequestException("restaurant endpoint temporarily unavailable")
        return [{
            "name": "Grounded Cafe",
            "latitude": center[0] + 0.002,
            "longitude": center[1] + 0.002,
            "category": "catering.cafe",
            "address": "Riyadh",
            "city": city,
            "opening_hours": "24/7",
            "place_id": "grounded-cafe",
            "requested_city": city,
            "requested_category": category,
            "source": "test-grounded-upstream",
            "source_retrieved_at_utc": "2026-09-07T00:00:00Z",
        }]

    monkeypatch.setattr(eng, "_fetch_places_from_upstream", partial_upstream)
    result = eng.fetch_ml_recommendations(
        city="Riyadh", interests=["Food"], trip_month=9, top_k=5
    )
    assert result is not None and not result.empty
    assert set(result["requested_category"]) == {"cafes"}
