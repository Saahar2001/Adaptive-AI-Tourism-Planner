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
