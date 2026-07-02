"""Portfolio subagent — value, allocation, performance queries."""
from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

from ..skills.portfolio import get_allocation, get_performance, get_portfolio_total
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
            "Report figures clearly in CAD."
        ),
        tools=[
            FunctionTool(get_portfolio_total),
            FunctionTool(get_allocation),
            FunctionTool(get_performance),
        ],
    )
