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
