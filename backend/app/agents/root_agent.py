"""Root orchestrator agent (SPEC §10 / §17).

Routes questions to the correct subagent, grounds every number in tool output,
and tailors tone to the active persona. Built lazily (per provider) so a live
``LLM_PROVIDER`` toggle takes effect without a process restart and so a missing
credential never crashes import.
"""
from __future__ import annotations

from google.adk.agents import LlmAgent

from .budgeting_agent import build_budgeting_agent
from .education_agent import build_education_agent
from .model_resolver import resolve_adk_model
from .portfolio_agent import build_portfolio_agent

ROOT_INSTRUCTION = (
    "You are the orchestrator for a wealth assistant serving a Canadian bank. "
    "The active persona_id is '{persona_id}'. Profile: {persona_profile}.\n"
    "Always:\n"
    "1. Ground every number in a tool call (via a subagent). Never invent "
    "balances, rates, or performance figures.\n"
    "2. Route portfolio questions to portfolio_agent, budgeting/debt questions "
    "to budgeting_agent, and education/market/advisor questions to "
    "education_agent.\n"
    "3. For complex questions (e.g. 'pay down debt or invest?'), gather from "
    "MULTIPLE subagents before answering.\n"
    "4. For the affluent persona, offer a warm handoff to a human advisor when "
    "volatility or complex planning is discussed.\n"
    "5. Match tone to persona: encouraging (first), reassuring (middle), "
    "premium/concise (affluent)."
)


def build_root_agent() -> LlmAgent:
    return LlmAgent(
        name="wealth_root",
        model=resolve_adk_model(),
        instruction=ROOT_INSTRUCTION,
        sub_agents=[
            build_portfolio_agent(),
            build_budgeting_agent(),
            build_education_agent(),
        ],
    )
