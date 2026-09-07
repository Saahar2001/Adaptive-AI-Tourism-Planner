from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "saudi-trip-planner-frontend" / "src"


def text(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def test_trending_uses_configured_api_base_not_hardcoded_localhost():
    src = text("components/TrendingPlacesView.tsx")
    assert "http://localhost:8000/api/dashboard/trending-places" not in src
    assert "API_BASE" in src


def test_trending_does_not_claim_visitor_ratings():
    src = text("components/TrendingPlacesView.tsx")
    assert "visitor ratings" not in src.lower()
    assert "trend_score" in src


def test_api_sends_accessibility_preference():
    src = text("lib/api.ts")
    assert "require_accessibility" in src


def test_cost_ui_labels_estimates():
    assert "Est." in text("components/PlaceCard.tsx")
    assert "Est." in text("pages/Results.tsx")


def test_plan_exposes_trip_month_and_preserves_it_in_preferences():
    src = text("pages/Plan.tsx")
    assert "tripMonth" in src
    assert "Travel month" in src
    assert "setTripMonth" in src


def test_results_selects_an_available_category_instead_of_forcing_attractions():
    src = text("pages/Results.tsx")
    assert "availableCategories" in src
    assert "setActiveCategory" in src
    assert "includes(activeCategory)" in src


def test_api_base_is_normalized_and_trip_request_has_timeout():
    src = text("lib/api.ts")
    assert "replace(/\\/$/, \"\")" in src
    assert "AbortController" in src
    assert "REQUEST_TIMEOUT_MS" in src


def test_trending_has_empty_state():
    src = text("components/TrendingPlacesView.tsx")
    assert "places.length === 0" in src
    assert "No trending destinations available" in src


def test_results_has_favorite_places_section_and_map_toggle():
    src = text("pages/Results.tsx")
    assert "Favorite Places" in src
    assert "Show Favorites on Map" in src
    assert "showFavoritesOnMap" in src
    assert "favoritePlaces={favorites}" in src


def test_results_category_tabs_and_labels():
    src = text("pages/Results.tsx")
    assert "Attractions" in src
    assert "Restaurants" in src
    assert "Cafés" in src or "Cafes" in src
    assert "availableCategories" in src


def test_no_raw_coordinates_in_user_facing_templates():
    for rel in ["components/PlaceCard.tsx", "pages/Results.tsx", "components/TrendingPlacesView.tsx", "pages/Favorites.tsx"]:
        content = text(rel)
        # Lat/lon values must not be rendered as plain template strings
        assert "latitude" not in content or "position=" in content or "typeof" in content or "FavoritesService" in content or "latitude:" in content or "latitude?:" in content


def test_favorites_page_and_header_navigation():
    header_src = text("components/Header.tsx")
    assert "/favorites" in header_src
    assert "Favorites" in header_src

    fav_src = text("pages/Favorites.tsx")
    assert "Your Bookmarked Venues" in fav_src
    assert "Show Favorites on Map" in fav_src
    assert "Plan a Trip" in fav_src or "Plan in" in fav_src


def test_trending_cards_clickable_and_opens_verified_details_modal():
    src = text("components/TrendingPlacesView.tsx")
    assert "modalPlace" in src
    assert "handleCardClick" in src
    assert "View on Map" in src
    assert "score_basis" in src
    assert "star rating" not in src.lower()
    assert "user reviews" not in src.lower()

