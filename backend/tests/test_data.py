from app.data_loader import (
    VALID_PERSONAS,
    load_persona,
    persona_client_brief,
    persona_net_worth,
)


def test_all_personas_load_with_consistent_shape():
    for pid in VALID_PERSONAS:
        p = load_persona(pid)
        assert p["persona_id"] == pid
        for key in ("name", "monthly_income", "monthly_expenses", "portfolio_total", "risk_profile"):
            assert key in p


def test_net_worth_math_matches_expected():
    assert persona_net_worth("first")["net_worth"] == -21250
    assert persona_net_worth("middle")["net_worth"] == 70200
    assert persona_net_worth("affluent")["net_worth"] == 2_715_000
    first = persona_net_worth("first")
    assert first["net_worth"] == first["cash"] + first["investments"] - first["debt"]
    assert first["debt"] == 23300  # credit card + student loan


def test_client_brief_has_net_worth_but_not_forward_looking():
    brief = persona_client_brief("middle")
    assert "Net worth" in brief
    assert "70,200" in brief
    # Forward-looking data (maturities, performance) is tool-only, never in the brief.
    assert "maturity" not in brief.lower()
    assert "upcoming" not in brief.lower()
    assert "benchmark" not in brief.lower()


def test_affluent_portfolio_over_one_million():
    assert load_persona("affluent")["portfolio_total"] > 1_000_000


def test_unknown_persona_raises():
    import pytest

    with pytest.raises(KeyError):
        load_persona("nope")
