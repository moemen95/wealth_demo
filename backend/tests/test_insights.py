"""Unit tests for the shared insight-card parser."""
import json

from app.architectures._insights import parse_insight_cards
from app.models.schemas import Insight


def _as_insight(card: dict) -> Insight:
    # Every card the parser emits must satisfy the API contract model.
    return Insight(**card)


def test_context_kind_populates_context_and_data_points():
    text = json.dumps(
        [
            {
                "title": "Grow your savings",
                "body": "You have room to save more.",
                "context": "Your surplus supports a higher rate.",
                "data_points": ["Surplus $1,200/mo", "Rate 20%"],
                "cta": "See how",
            }
        ]
    )
    cards = parse_insight_cards(text, kind="context", grounded=True)
    assert len(cards) == 1
    card = cards[0]
    assert card["kind"] == "context"
    assert card["grounded"] is True
    assert card["context"]
    assert card["data_points"] == ["Surplus $1,200/mo", "Rate 20%"]
    _as_insight(card)


def test_scenario_kind_with_alternatives_and_projection():
    text = json.dumps(
        [
            {
                "title": "Debt vs invest",
                "body": "You could do either.",
                "short_term": "Free up cash flow.",
                "long_term": "Compounding wins.",
                "alternatives": [
                    {"label": "Pay debt", "detail": "...", "tradeoff": "less growth",
                     "recommended": False},
                    {"label": "Invest", "detail": "...", "recommended": True},
                ],
                "recommended_action": "Split 50/50.",
                "recommended_impact": "+$18k over 5 yrs",
                "projection": {
                    "unit": "CAD",
                    "horizon_label": "5-year outlook",
                    "series": [
                        {"label": "Invest",
                         "points": [{"t": "Y0", "value": 1000}, {"t": "Y1", "value": "1100"}]},
                    ],
                },
                "cta": "Discuss",
            }
        ]
    )
    card = parse_insight_cards(text, kind="scenario", grounded=True)[0]
    assert card["kind"] == "scenario"
    assert len(card["alternatives"]) == 2
    assert any(a["recommended"] for a in card["alternatives"])
    assert card["recommended_impact"] == "+$18k over 5 yrs"
    # String value coerced to float.
    assert card["projection"]["series"][0]["points"][1]["value"] == 1100.0
    _as_insight(card)


def test_malformed_projection_is_dropped_not_fatal():
    text = json.dumps(
        [
            {
                "title": "Bad chart",
                "body": "...",
                "projection": {"series": [{"label": "x", "points": [{"t": "Y0"}]}]},
                "cta": "ok",
            }
        ]
    )
    card = parse_insight_cards(text, kind="scenario", grounded=True)[0]
    # Only one point (and non-numeric) -> whole projection dropped, card survives.
    assert card["projection"] is None
    _as_insight(card)


def test_non_json_falls_back_to_single_card():
    cards = parse_insight_cards("the model rambled with no json", kind="scenario",
                                grounded=False)
    assert len(cards) == 1
    assert cards[0]["kind"] == "scenario"
    assert cards[0]["grounded"] is False
    _as_insight(cards[0])
