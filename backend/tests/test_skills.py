from app.skills import execute_skill
from app.skills.budgeting import get_debt_strategy, get_income_expenses, suggest_savings_rate
from app.skills.portfolio import get_allocation, get_portfolio_total


def test_portfolio_totals_are_grounded():
    assert get_portfolio_total("middle") == {"portfolio_total": 25000, "currency": "CAD"}
    assert get_portfolio_total("affluent")["portfolio_total"] == 2_450_000
    assert get_portfolio_total("first")["portfolio_total"] == 0


def test_allocation_weights_sum_to_one():
    alloc = get_allocation("affluent")
    assert alloc["total"] == 2_450_000
    assert abs(sum(b["weight"] for b in alloc["breakdown"]) - 1.0) < 1e-6


def test_income_expenses_surplus():
    ie = get_income_expenses("middle")
    assert ie["monthly_surplus"] == ie["monthly_income"] - ie["monthly_expenses"]


def test_savings_rate_capped_by_surplus_and_debt_aware():
    first = suggest_savings_rate("first")
    # First has high-interest CC debt -> debt-aware 10% target
    assert first["recommended_rate"] == 0.10
    assert first["recommended_amount"] <= first["monthly_surplus"]


def test_debt_strategy_recommends_avalanche_for_high_interest():
    strat = get_debt_strategy("first")
    assert strat["has_debt"] is True
    assert strat["recommended"] == "avalanche"
    # Highest-rate debt ordered first in avalanche
    assert strat["avalanche"]["order"][0]["type"] == "credit_card"


def test_middle_has_no_debt():
    assert get_debt_strategy("middle")["has_debt"] is False


def test_execute_skill_tolerates_bad_args():
    # Extra kwargs get filtered, missing required surfaces an error dict.
    assert execute_skill("get_portfolio_total", {"persona_id": "middle", "junk": 1})[
        "portfolio_total"
    ] == 25000
    assert "error" in execute_skill("nonexistent_skill", {})
