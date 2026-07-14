"""Investment-projection skill — a deterministic compound-growth model.

Used by the Agentic architecture to give scenarios a *true* projected outcome
instead of LLM-invented numbers. The math is plain compound interest with monthly
contributions, so the same inputs always yield the same series — which is what the
comparison chart plots.
"""
from __future__ import annotations

from ..data_loader import load_persona

CURRENCY = "CAD"


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def project_strategy(
    persona_id: str,
    annual_return: float,
    monthly_contribution: float | None = None,
    years: int = 10,
    metric: str = "portfolio_value",
    withdrawal_rate: float = 0.04,
    tax_rate: float = 0.0,
    start_value: float | None = None,
) -> dict:
    """Project the outcome of an investment strategy year by year.

    Compounds the current portfolio plus monthly contributions at ``annual_return``
    (monthly compounding) over ``years``, then expresses each year as the requested
    ``metric``:
      * ``portfolio_value``   — the projected balance.
      * ``annual_income``     — balance × ``withdrawal_rate`` (sustainable draw).
      * ``after_tax_value``   — balance × (1 − ``tax_rate``).

    Grounded defaults come from the persona: ``start_value`` = current portfolio
    total, ``monthly_contribution`` = monthly income − expenses (surplus). All
    inputs are clamped to sane ranges so a scenario can never produce nonsense.
    """
    data = load_persona(persona_id)
    if start_value is None:
        start_value = float(data.get("portfolio_total", 0) or 0)
    if monthly_contribution is None:
        monthly_contribution = float(data["monthly_income"]) - float(
            data["monthly_expenses"]
        )

    start_value = max(0.0, float(start_value))
    monthly_contribution = max(0.0, float(monthly_contribution))
    annual_return = _clamp(float(annual_return), 0.0, 0.12)
    years = int(_clamp(float(years), 3, 30))
    metric = metric if metric in {"portfolio_value", "annual_income", "after_tax_value"} else "portfolio_value"
    withdrawal_rate = _clamp(float(withdrawal_rate), 0.02, 0.08)
    tax_rate = _clamp(float(tax_rate), 0.0, 0.5)

    m = annual_return / 12.0

    def balance_at(year: int) -> float:
        n = year * 12
        growth = start_value * (1 + m) ** n
        if m == 0:
            contrib = monthly_contribution * n
        else:
            contrib = monthly_contribution * (((1 + m) ** n - 1) / m)
        return growth + contrib

    def to_metric(bal: float) -> float:
        if metric == "annual_income":
            return bal * withdrawal_rate
        if metric == "after_tax_value":
            return bal * (1 - tax_rate)
        return bal

    series = [
        {"t": f"Y{y}", "value": round(to_metric(balance_at(y)), 2)}
        for y in range(0, years + 1)
    ]
    final_balance = balance_at(years)
    total_contributions = round(monthly_contribution * 12 * years, 2)
    # CAGR of the underlying balance (independent of the display metric).
    cagr = round((final_balance / start_value) ** (1 / years) - 1, 4) if start_value > 0 else None

    return {
        "currency": CURRENCY,
        "metric": metric,
        "years": years,
        "annual_return": round(annual_return, 4),
        "monthly_contribution": round(monthly_contribution, 2),
        "start_value": round(start_value, 2),
        "series": series,
        "final_value": round(to_metric(final_balance), 2),
        "final_balance": round(final_balance, 2),
        "total_contributions": total_contributions,
        "cagr": cagr,
    }
