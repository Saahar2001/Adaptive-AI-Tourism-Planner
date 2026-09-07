import pytest
from pydantic import ValidationError

import main


def test_plan_request_rejects_non_positive_budget():
    with pytest.raises(ValidationError):
        main.PlanTripRequest(city="Riyadh", budget=0)


def test_plan_request_rejects_invalid_days():
    with pytest.raises(ValidationError):
        main.PlanTripRequest(city="Riyadh", days=0)
    with pytest.raises(ValidationError):
        main.PlanTripRequest(city="Riyadh", days=15)


def test_plan_request_rejects_unknown_transport_mode():
    with pytest.raises(ValidationError):
        main.PlanTripRequest(city="Riyadh", transport_mode="teleport")


def test_trending_schema_uses_trend_score_not_fake_rating(monkeypatch):
    monkeypatch.setattr(main, "get_exact_place_photo", lambda *args, **kwargs: None)
    payload = main.get_trending_places()
    assert payload["status"] == "success"
    for place in payload["trending_places"]:
        assert "trend_score" in place
        assert "rating" not in place
        assert 0.0 <= place["trend_score"] <= 1.0


def test_model_info_endpoint_function_reports_actual_capabilities():
    info = main.model_info()
    assert "recommendation_context" in info
    assert "forecast_model" in info
    assert "limitations" in info


def test_image_resolver_returns_none_safely_when_unresolved():
    assert main.get_exact_place_photo(None, "Riyadh") is None
    assert main.get_exact_place_photo("", "Riyadh") is None
    assert main.get_exact_place_photo("Unknown Place", "Riyadh") is None
    assert main.get_exact_place_photo("Unnamed place", "Riyadh") is None


def test_wikipedia_photo_parser_checks_similarity(monkeypatch):
    class FakeResponse:
        def json(self):
            return {
                "query": {
                    "pages": {
                        "1": {
                            "title": "National Museum of Saudi Arabia",
                            "thumbnail": {"source": "https://example.com/museum.jpg"},
                        }
                    }
                }
            }

    monkeypatch.setattr(main.requests, "get", lambda *args, **kwargs: FakeResponse())
    photo = main._wikipedia_photo("National Museum", "Riyadh")
    assert photo == "https://example.com/museum.jpg"


def test_assistant_chat_fallback_when_no_api_key(monkeypatch):
    monkeypatch.setattr(main.eng, "llm_configured", lambda: False)
    req = main.AssistantChatRequest(
        message="What is my budget?",
        trip_context={"prefs": {"city": "Riyadh", "budget": 2500, "days": 3, "interests": ["Food"]}}
    )
    res = main.assistant_chat(req)
    assert "response" in res
    assert res["model"] == "rule_based"
    assert "2500" in res["response"]


def test_assistant_chat_grounds_answer_in_trip_context(monkeypatch):
    monkeypatch.setattr(main.eng, "llm_configured", lambda: False)
    req = main.AssistantChatRequest(
        message="What is on Day 1?",
        trip_context={
            "city": "Makkah",
            "itinerary": [
                {"day": 1, "place": "Clock Tower Museum", "visit_duration_hours": 2.0}
            ]
        }
    )
    res = main.assistant_chat(req)
    assert "Clock Tower Museum" in res["response"]
    assert "Day 1" in res["response"]


def test_assistant_chat_handles_general_saudi_tourism_query(monkeypatch):
    monkeypatch.setattr(main.eng, "llm_configured", lambda: False)
    req = main.AssistantChatRequest(message="What is the currency in Saudi Arabia?")
    res = main.assistant_chat(req)
    assert "Saudi Riyal" in res["response"] or "SAR" in res["response"]


def test_image_resolver_handles_network_error_safely(monkeypatch):
    def raise_err(*args, **kwargs):
        raise main.requests.RequestException("Connection timed out")

    monkeypatch.setattr(main.requests, "get", raise_err)
    res = main._wikipedia_photo("Some Random Venue", "Riyadh")
    assert res is None


def test_trending_payload_includes_safe_image_url_and_metadata():
    payload = main.get_trending_places()
    assert payload["status"] == "success"
    assert len(payload["trending_places"]) > 0
    for place in payload["trending_places"]:
        assert "image_url" in place
        assert "name" in place
        assert "city" in place
        assert "trend_score" in place
        assert "score_basis" in place
        assert "rating" not in place
        assert "stars" not in place


def test_plan_trip_all_interests_returns_mixed_categories(monkeypatch):
    monkeypatch.setattr(main, "_wikipedia_photo", lambda name, city: None)
    req = main.PlanTripRequest(
        city="Riyadh",
        budget=1000,
        days=3,
        interests=["Culture & Heritage", "Food", "Nature", "Adventure", "Shopping", "Relaxation"],
        transport_mode="driving",
        require_accessibility=False,
        trip_month=9,
    )
    res = main.plan_trip(req)
    categories = {p["category"] for p in res["places"]}
    # Must contain attractions, restaurants, and cafes
    assert "attraction" in categories
    assert "restaurant" in categories
    assert "cafe" in categories


def test_plan_trip_food_only_returns_no_attractions(monkeypatch):
    monkeypatch.setattr(main, "_wikipedia_photo", lambda name, city: None)
    req = main.PlanTripRequest(
        city="Riyadh",
        budget=1000,
        days=2,
        interests=["Food"],
        transport_mode="driving",
        require_accessibility=False,
        trip_month=9,
    )
    res = main.plan_trip(req)
    categories = {p["category"] for p in res["places"]}
    assert "attraction" not in categories
    assert categories <= {"restaurant", "cafe"}


def test_partial_upstream_failure_preserves_successful_categories(monkeypatch):
    # Simulate partial failure where "attractions" fails upstream but "cafes" succeeds
    def partial_fetch(city, category, limit):
        if category == "attractions":
            raise main.requests.RequestException("Upstream 500 error for attractions")
        return [
            {
                "name": "Live Cafe 1",
                "latitude": 24.7,
                "longitude": 46.7,
                "category": "catering.cafe",
                "address": "Riyadh",
                "city": city,
                "country": "Saudi Arabia",
                "opening_hours": "24/7",
                "place_id": "cafe-1",
                "requested_city": city,
                "requested_category": "cafes",
                "source": "live-places",
                "source_retrieved_at_utc": "2026-09-07T00:00:00+00:00",
            }
        ]

    monkeypatch.setattr(main.eng, "_fetch_places_from_upstream", partial_fetch)
    ml_recs = main.eng.fetch_ml_recommendations("Riyadh", ["Culture & Heritage", "Food"], trip_month=9, top_k=5)
    assert ml_recs is not None
    assert not ml_recs.empty
    # The successful category "cafes" was kept!
    assert any("cafe" in str(cat).lower() for cat in ml_recs["place_type"])
