"""Education subagent — concept explanations, market context, advisor handoff."""
from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

from ..skills.advisor import book_advisor_meeting
from ..skills.market import get_market_snapshot
from .model_resolver import resolve_adk_model


def build_education_agent() -> LlmAgent:
    return LlmAgent(
        name="education_agent",
        model=resolve_adk_model(),
        description=(
            "Explains financial concepts in plain language, provides market "
            "context, and can book a meeting with a human advisor."
        ),
        instruction=(
            "You educate persona_id '{persona_id}' in plain, reassuring "
            "language. Use get_market_snapshot for any market/volatility "
            "context. If the user is anxious about markets or asks for complex "
            "planning, offer a warm handoff and use book_advisor_meeting "
            "(persona_id='{persona_id}') when they accept. Never invent market "
            "figures."
        ),
        tools=[
            FunctionTool(get_market_snapshot),
            FunctionTool(book_advisor_meeting),
        ],
    )
