"""Structured skills (tools) the LLM can call.

Each skill is a plain Python function that loads grounded data from the mock
persona profiles. The same functions back both Architecture 2 (Skills) and
Architecture 3 (Agentic ADK), wrapped as ``FunctionTool``s there.
"""
from .advisor import book_advisor_meeting
from .budgeting import get_debt_strategy, get_income_expenses, suggest_savings_rate
from .market import get_market_snapshot
from .portfolio import get_allocation, get_performance, get_portfolio_total
from .registry import (
    SKILL_FUNCTIONS,
    SKILL_SCHEMAS,
    execute_skill,
    schemas_for,
)

__all__ = [
    "book_advisor_meeting",
    "get_debt_strategy",
    "get_income_expenses",
    "suggest_savings_rate",
    "get_market_snapshot",
    "get_allocation",
    "get_performance",
    "get_portfolio_total",
    "SKILL_FUNCTIONS",
    "SKILL_SCHEMAS",
    "execute_skill",
    "schemas_for",
]
