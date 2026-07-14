"""Portfolio subagent — value, allocation, performance queries."""
from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

from ..skills.portfolio import get_allocation, get_performance, get_portfolio_total
from ..skills.projection import project_strategy
from .model_resolver import resolve_adk_model


def build_portfolio_agent() -> LlmAgent:
    return LlmAgent(
        name="portfolio_agent",
        model=resolve_adk_model(),
        description=(
            "Handles portfolio value, asset allocation, and performance vs "
            "benchmark questions."
        ),
        instruction=(
            "You handle portfolio questions for persona_id '{persona_id}'. "
            "Always call your tools with persona_id='{persona_id}' to fetch "
            "grounded numbers — never invent balances, weights, or returns. "
            "Use project_strategy to model the true year-by-year outcome of an "
            "investment strategy (given an annual_return and monthly_contribution) "
            "instead of estimating growth yourself. Report figures clearly in CAD."
        ),
        tools=[
            FunctionTool(get_portfolio_total),
            FunctionTool(get_allocation),
            FunctionTool(get_performance),
            FunctionTool(project_strategy),
        ],
    )
