import pandas as pd
import pytest

import ml_engine as eng


def _create_synthetic_candidates(count=25, cost=50.0, duration=1.0):
    center_lat, center_lon = eng.CITY_CENTERS["Riyadh"]
    rows = []
    for i in range(count):
        rows.append({
            "name": f"Synthetic Venue {i + 1}",
            "city": "Riyadh",
            "place_type": "attraction",
            "category": "attraction",
            "latitude": center_lat + 0.001 * (i + 1),
            "longitude": center_lon + 0.001 * (i + 1),
            "estimated_cost": float(cost),
            "cost_is_estimate": True,
            "visit_duration_hours": float(duration),
            "total_time_hours": float(duration),
            "recommendation_score": round(0.95 - (i * 0.01), 3),
            "opening_hours_raw": "24/7",
            "accessibility_status": "yes",
        })
    return pd.DataFrame(rows)


def test_1_no_day_exceeds_max_stops():
    """Test 1: 5 requested days with sufficient candidates and budget must not exceed EXPECTED_STOPS_PER_DAY stops on any day."""
    recs = _create_synthetic_candidates(count=25, cost=40.0, duration=1.0)
    itinerary = eng.generate_itinerary(
        recs, budget=1000.0, days=5, hours_per_day=8.0, city="Riyadh"
    )
    assert not itinerary.empty
    counts_per_day = itinerary["day"].value_counts().to_dict()
    for day, count in counts_per_day.items():
        assert count <= eng.EXPECTED_STOPS_PER_DAY, f"Day {day} has {count} stops, exceeding max {eng.EXPECTED_STOPS_PER_DAY}"


def test_2_stops_distributed_across_all_requested_days():
    """Test 2: 5 requested days with ample budget and candidates must distribute stops across all 5 days."""
    recs = _create_synthetic_candidates(count=25, cost=40.0, duration=1.0)
    itinerary = eng.generate_itinerary(
        recs, budget=1000.0, days=5, hours_per_day=8.0, city="Riyadh"
    )
    assert not itinerary.empty
    scheduled_days = set(itinerary["day"].unique())
    assert scheduled_days == {1, 2, 3, 4, 5}, f"Scheduled days {scheduled_days} do not cover all 5 days"


def test_3_total_cost_never_exceeds_budget():
    """Test 3: Total cost of scheduled stops must not exceed the total trip budget."""
    recs = _create_synthetic_candidates(count=25, cost=60.0, duration=1.0)
    budget = 500.0
    itinerary = eng.generate_itinerary(
        recs, budget=budget, days=5, hours_per_day=8.0, city="Riyadh"
    )
    assert not itinerary.empty
    total_cost = itinerary["estimated_cost"].sum()
    assert total_cost <= budget + 1e-6, f"Total cost {total_cost} exceeds budget {budget}"


def test_4_day_1_cumulative_spending_ceiling():
    """Test 4: Cumulative spending after Day 1 must not exceed the Day 1 cumulative budget ceiling."""
    recs = _create_synthetic_candidates(count=25, cost=50.0, duration=1.0)
    budget = 1000.0
    days = 5
    itinerary = eng.generate_itinerary(
        recs, budget=budget, days=days, hours_per_day=8.0, city="Riyadh"
    )
    assert not itinerary.empty
    day1_stops = itinerary[itinerary["day"] == 1]
    day1_cost = day1_stops["estimated_cost"].sum()
    day1_ceiling = (budget * 1) / days  # 200 SAR
    assert day1_cost <= day1_ceiling + 1e-6, f"Day 1 cost {day1_cost} exceeds Day 1 ceiling {day1_ceiling}"


def test_5_cumulative_spending_through_each_day():
    """Test 5: Cumulative spending through Day N must not exceed the Day N cumulative budget ceiling."""
    recs = _create_synthetic_candidates(count=25, cost=50.0, duration=1.0)
    budget = 1000.0
    days = 5
    itinerary = eng.generate_itinerary(
        recs, budget=budget, days=days, hours_per_day=8.0, city="Riyadh"
    )
    assert not itinerary.empty
    for d in range(1, days + 1):
        cum_cost = itinerary[itinerary["day"] <= d]["estimated_cost"].sum()
        cum_ceiling = (budget * d) / days
        assert cum_cost <= cum_ceiling + 1e-6, f"Cumulative cost {cum_cost} at Day {d} exceeds ceiling {cum_ceiling}"


def test_6_one_day_request_works():
    """Test 6: 1-day request schedules stops up to EXPECTED_STOPS_PER_DAY within budget and day hours."""
    recs = _create_synthetic_candidates(count=10, cost=50.0, duration=1.5)
    itinerary = eng.generate_itinerary(
        recs, budget=300.0, days=1, hours_per_day=8.0, city="Riyadh"
    )
    assert not itinerary.empty
    assert set(itinerary["day"].unique()) == {1}
    assert len(itinerary) <= eng.EXPECTED_STOPS_PER_DAY
    assert itinerary["estimated_cost"].sum() <= 300.0


def test_7_three_day_request_works():
    """Test 7: 3-day request schedules stops across days within budget without exceeding max stops per day."""
    recs = _create_synthetic_candidates(count=20, cost=50.0, duration=1.5)
    itinerary = eng.generate_itinerary(
        recs, budget=600.0, days=3, hours_per_day=8.0, city="Riyadh"
    )
    assert not itinerary.empty
    for day, count in itinerary["day"].value_counts().items():
        assert count <= eng.EXPECTED_STOPS_PER_DAY
    assert itinerary["estimated_cost"].sum() <= 600.0


def test_8_low_budget_legitimately_contains_fewer_stops():
    """Test 8: Low budget trip may contain fewer stops or empty days without breaking budget constraint."""
    recs = _create_synthetic_candidates(count=20, cost=80.0, duration=1.0)
    budget = 100.0  # Only allows at most 1 stop of 80 SAR
    itinerary = eng.generate_itinerary(
        recs, budget=budget, days=5, hours_per_day=8.0, city="Riyadh"
    )
    if not itinerary.empty:
        assert itinerary["estimated_cost"].sum() <= budget
        assert len(itinerary) <= 2


def test_9_per_stop_allowance_scales_inversely_with_days():
    """Test 9: With the same total budget, 1-day allowance > 3-day allowance > 5-day allowance."""
    budget = 1000.0
    allowance_1 = eng.estimate_per_stop_budget_allowance(budget, days=1)
    allowance_3 = eng.estimate_per_stop_budget_allowance(budget, days=3)
    allowance_5 = eng.estimate_per_stop_budget_allowance(budget, days=5)

    assert allowance_1 > allowance_3 > allowance_5
    assert allowance_1 == pytest.approx(1000.0 / 4)
    assert allowance_3 == pytest.approx(1000.0 / 12)
    assert allowance_5 == pytest.approx(1000.0 / 20)


def test_10_affordable_venue_budget_fit_saturated():
    """Test 10: A venue that is already fully affordable may have budget_fit = 1.0 for both 1000 and 10000 SAR."""
    cost = 35.0  # Cafe
    days = 3
    fit_1000 = eng.calculate_budget_score(cost, budget=1000.0, days=days)
    fit_10000 = eng.calculate_budget_score(cost, budget=10000.0, days=days)

    assert fit_1000 == pytest.approx(1.0)
    assert fit_10000 == pytest.approx(1.0)
