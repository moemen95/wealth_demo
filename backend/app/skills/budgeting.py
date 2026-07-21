"""Budgeting skills — income/expenses, savings rate, debt strategy."""
from __future__ import annotations

from ..data_loader import load_persona

CURRENCY = "CAD"


def get_income_expenses(persona_id: str) -> dict:
    """Return monthly income, expenses, and surplus/deficit."""
    data = load_persona(persona_id)
    income = data["monthly_income"]
    expenses = data["monthly_expenses"]
    surplus = income - expenses
    return {
        "currency": CURRENCY,
        "monthly_income": income,
        "monthly_expenses": expenses,
        "monthly_surplus": surplus,
        "surplus_rate": round(surplus / income, 4) if income else 0.0,
    }


def suggest_savings_rate(persona_id: str) -> dict:
    """Recommend a savings rate and dollar amount grounded in the profile.

    Heuristic: target 20% of income (50/30/20), but never exceed the actual
    monthly surplus, and step it down if a high-interest debt exists.
    """
    data = load_persona(persona_id)
    income = data["monthly_income"]
    surplus = income - data["monthly_expenses"]

    has_high_interest_debt = any(
        (d.get("rate") or 0) >= 0.15 for d in data.get("debts", [])
    )
    target_rate = 0.20
    rationale = "Standard 50/30/20 guideline targets ~20% savings."
    if has_high_interest_debt:
        target_rate = 0.10
        rationale = (
            "High-interest debt detected — prioritise a smaller emergency "
            "buffer (~10%) while directing the rest to debt paydown."
        )

    target_amount = round(income * target_rate)
    feasible_amount = max(0, min(target_amount, surplus))
    return {
        "currency": CURRENCY,
        "recommended_rate": target_rate,
        "recommended_amount": feasible_amount,
        "monthly_surplus": surplus,
        "capped_by_surplus": feasible_amount < target_amount,
        "rationale": rationale,
    }


def get_debt_strategy(persona_id: str) -> dict:
    """Return an avalanche vs snowball comparison for the user's debts."""
    data = load_persona(persona_id)
    debts = data.get("debts", [])
    if not debts:
        return {"has_debt": False, "message": "No outstanding debts on file."}

    avalanche = sorted(debts, key=lambda d: d.get("rate", 0), reverse=True)
    snowball = sorted(debts, key=lambda d: d.get("balance", 0))
    total_balance = sum(d.get("balance", 0) for d in debts)

    def order(items):
        return [
            {
                "type": d["type"],
                "balance": d.get("balance"),
                "rate": d.get("rate"),
            }
            for d in items
        ]

    return {
        "has_debt": True,
        "currency": CURRENCY,
        "total_debt": total_balance,
        "avalanche": {
            "order": order(avalanche),
            "why": "Pay highest interest rate first — minimises total interest paid.",
        },
        "snowball": {
            "order": order(snowball),
            "why": "Pay smallest balance first — fastest psychological wins.",
        },
        "recommended": "avalanche" if any((d.get("rate") or 0) >= 0.15 for d in debts) else "snowball",
    }
