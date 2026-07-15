"""Budgeting subagent — income/expenses, savings rate, debt strategy."""
from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

from ..skills.budgeting import get_debt_strategy, get_income_expenses, suggest_savings_rate
from .model_resolver import adk_generate_content_config, resolve_adk_model


def build_budgeting_agent() -> LlmAgent:
    return LlmAgent(
        name="budgeting_agent",
        model=resolve_adk_model(),
        generate_content_config=adk_generate_content_config(),
        description=(
            "Handles cash-flow, savings-rate, and debt-paydown (avalanche vs "
            "snowball) questions."
        ),
        instruction=(
            "You handle budgeting and debt questions for persona_id "
            "'{persona_id}'. Always call your tools with persona_id="
            "'{persona_id}' before giving numbers. For 'pay debt or invest' "
            "questions, first fetch income/expenses AND the debt strategy, then "
            "reason about the trade-off (compare debt interest rate to expected "
            "investment return). Never invent figures."
        ),
        tools=[
            FunctionTool(get_income_expenses),
            FunctionTool(suggest_savings_rate),
            FunctionTool(get_debt_strategy),
        ],
    )
