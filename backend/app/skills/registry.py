"""Skill registry — maps skill names to callables + normalised (OpenAI-style)
tool schemas. The provider layer converts these to Gemini declarations."""
from __future__ import annotations

from typing import Any, Callable

from .advisor import book_advisor_meeting
from .budgeting import get_debt_strategy, get_income_expenses, suggest_savings_rate
from .market import get_market_snapshot
from .portfolio import get_allocation, get_performance, get_portfolio_total

SKILL_FUNCTIONS: dict[str, Callable[..., dict]] = {
    "get_portfolio_total": get_portfolio_total,
    "get_allocation": get_allocation,
    "get_performance": get_performance,
    "get_income_expenses": get_income_expenses,
    "suggest_savings_rate": suggest_savings_rate,
    "get_debt_strategy": get_debt_strategy,
    "get_market_snapshot": get_market_snapshot,
    "book_advisor_meeting": book_advisor_meeting,
}


def _tool(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
    }


_PERSONA_PROP = {"persona_id": {"type": "string", "description": "one of: first, middle, affluent"}}

SKILL_SCHEMAS: list[dict] = [
    _tool(
        "get_portfolio_total",
        "Returns the user's current total portfolio value.",
        dict(_PERSONA_PROP),
        ["persona_id"],
    ),
    _tool(
        "get_allocation",
        "Returns the portfolio breakdown by asset class with weights.",
        dict(_PERSONA_PROP),
        ["persona_id"],
    ),
    _tool(
        "get_performance",
        "Returns portfolio performance vs benchmark for a time window.",
        {
            **_PERSONA_PROP,
            "window": {
                "type": "string",
                "description": "1M, 3M, YTD, or 1Y",
                "enum": ["1M", "3M", "YTD", "1Y"],
            },
        },
        ["persona_id"],
    ),
    _tool(
        "get_income_expenses",
        "Returns monthly income, expenses, and surplus.",
        dict(_PERSONA_PROP),
        ["persona_id"],
    ),
    _tool(
        "suggest_savings_rate",
        "Returns a recommended savings rate and dollar amount grounded in the profile.",
        dict(_PERSONA_PROP),
        ["persona_id"],
    ),
    _tool(
        "get_debt_strategy",
        "Returns an avalanche vs snowball debt-paydown comparison.",
        dict(_PERSONA_PROP),
        ["persona_id"],
    ),
    _tool(
        "get_market_snapshot",
        "Returns headline market indices and a one-line context. Takes no arguments.",
        {},
        [],
    ),
    _tool(
        "book_advisor_meeting",
        "Books a (mock) meeting with a human wealth advisor.",
        {
            **_PERSONA_PROP,
            "topic": {"type": "string", "description": "meeting topic"},
        },
        ["persona_id"],
    ),
]


def schemas_for(names: list[str] | None = None) -> list[dict]:
    """Return tool schemas, optionally filtered to a subset of skill names."""
    if names is None:
        return SKILL_SCHEMAS
    wanted = set(names)
    return [s for s in SKILL_SCHEMAS if s["function"]["name"] in wanted]


def execute_skill(name: str, arguments: dict[str, Any]) -> Any:
    """Execute a skill by name, tolerating extra/missing kwargs."""
    fn = SKILL_FUNCTIONS.get(name)
    if fn is None:
        return {"error": f"Unknown skill '{name}'"}
    try:
        return fn(**(arguments or {}))
    except TypeError:
        # Model passed unexpected/missing kwargs — retry with only known ones.
        import inspect

        sig = inspect.signature(fn)
        valid = {k: v for k, v in (arguments or {}).items() if k in sig.parameters}
        try:
            return fn(**valid)
        except Exception as exc:  # noqa: BLE001
            return {"error": f"{name} failed: {exc}"}
    except Exception as exc:  # noqa: BLE001
        return {"error": f"{name} failed: {exc}"}
