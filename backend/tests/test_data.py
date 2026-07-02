from app.data_loader import VALID_PERSONAS, load_persona


def test_all_personas_load_with_consistent_shape():
    for pid in VALID_PERSONAS:
        p = load_persona(pid)
        assert p["persona_id"] == pid
        for key in ("name", "monthly_income", "monthly_expenses", "portfolio_total", "risk_profile"):
            assert key in p


def test_affluent_portfolio_over_one_million():
    assert load_persona("affluent")["portfolio_total"] > 1_000_000


def test_unknown_persona_raises():
    import pytest

    with pytest.raises(KeyError):
        load_persona("nope")
