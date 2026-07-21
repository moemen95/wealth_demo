"""Unit tests for the deterministic investment-projection skill."""
from app.skills.projection import project_strategy


def test_compound_growth_no_contributions():
    # $100k @ 6% annual (monthly compounded) for 10y ≈ $181,939.67
    r = project_strategy("middle", annual_return=0.06, monthly_contribution=0, years=10,
                         start_value=100_000)
    assert r["series"][0] == {"t": "Y0", "value": 100_000.0}
    assert abs(r["final_value"] - 181_939.67) < 1.0
    assert len(r["series"]) == 11  # Y0..Y10
    assert r["total_contributions"] == 0.0


def test_contributions_add_up_and_grow():
    # With contributions the final value exceeds the no-contribution case and
    # total_contributions is tracked separately.
    r = project_strategy("middle", annual_return=0.05, monthly_contribution=1000, years=10,
                         start_value=0)
    assert r["total_contributions"] == 120_000.0  # 1000*12*10
    assert r["final_value"] > 120_000.0            # growth on top of contributions


def test_after_tax_scales_the_balance():
    base = project_strategy("affluent", annual_return=0.05, monthly_contribution=0, years=5,
                            start_value=1_000_000, metric="portfolio_value")
    after_tax = project_strategy("affluent", annual_return=0.05, monthly_contribution=0, years=5,
                                 start_value=1_000_000, metric="after_tax_value", tax_rate=0.25)
    assert abs(after_tax["final_value"] - base["final_value"] * 0.75) < 1.0


def test_income_metric_is_decumulation_not_accumulation():
    # Retirement income = sustainable drawdown: contributions are ignored (a retiree
    # draws FROM the portfolio) and the balance nets out the withdrawal, so net growth
    # = return - withdrawal_rate. This is what stops the "millions contributed" and
    # inflated-income nonsense for a retiree.
    r = project_strategy("affluent", annual_return=0.06, years=10, start_value=1_000_000,
                         metric="annual_income", withdrawal_rate=0.04,
                         monthly_contribution=5000)  # contribution must be ignored
    assert r["total_contributions"] == 0.0
    assert abs(r["series"][0]["value"] - 40_000.0) < 1e-6  # year 0 income = 1M * 4%
    expected_final = 1_000_000 * (1 + (0.06 - 0.04)) ** 10 * 0.04
    assert abs(r["final_value"] - expected_final) < 1.0


def test_income_metric_zeroes_contributions_by_default():
    # Even with the persona's surplus available, an income projection must not
    # contribute (the affluent persona is a retiree).
    r = project_strategy("affluent", annual_return=0.05, years=15, metric="annual_income")
    assert r["total_contributions"] == 0.0
    assert r["monthly_contribution"] == 0.0


def test_inputs_are_clamped():
    r = project_strategy("middle", annual_return=99.0, monthly_contribution=-500, years=999,
                         start_value=10_000)
    assert r["annual_return"] == 0.12   # clamped to max
    assert r["monthly_contribution"] == 0.0  # negative clamped to 0
    assert r["years"] == 30             # clamped to max


def test_grounded_defaults_from_persona():
    # middle: portfolio_total 25000, surplus 7800-5200=2600
    r = project_strategy("middle", annual_return=0.05)
    assert r["start_value"] == 25_000.0
    assert r["monthly_contribution"] == 2_600.0
