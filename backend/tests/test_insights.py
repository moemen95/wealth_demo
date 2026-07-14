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


def test_scenario_kind_recommended_action_only():
    # Scenario cards now carry a narrative + recommended action, but NO
    # alternatives and NO per-card projection (the comparison chart is computed
    # separately in agentic_adk). Any alternatives/projection in the raw JSON are
    # ignored by the shared parser.
    text = json.dumps(
        [
            {
                "title": "Balanced growth",
                "body": "A balanced plan.",
                "short_term": "Free up cash flow.",
                "long_term": "Compounding wins.",
                "alternatives": [{"label": "Ignored", "detail": "..."}],
                "projection": {"series": [{"label": "x", "points": [{"t": "Y0", "value": 1}]}]},
                "recommended_action": "Contribute monthly.",
                "cta": "Discuss",
            }
        ]
    )
    card = parse_insight_cards(text, kind="scenario", grounded=True)[0]
    assert card["kind"] == "scenario"
    assert card["short_term"] and card["long_term"]
    assert card["recommended_action"] == "Contribute monthly."
    # Alternatives / projection are no longer coerced onto scenario cards.
    assert "alternatives" not in card
    assert "projection" not in card
    _as_insight(card)


def test_non_json_falls_back_to_single_card():
    cards = parse_insight_cards("the model rambled with no json", kind="scenario",
                                grounded=False)
    assert len(cards) == 1
    assert cards[0]["kind"] == "scenario"
    assert cards[0]["grounded"] is False
    _as_insight(cards[0])
