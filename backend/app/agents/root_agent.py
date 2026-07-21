"""Root orchestrator agent (SPEC §10 / §17).

Routes questions to the correct subagent, grounds every number in tool output,
and tailors tone to the active persona. Built lazily (per provider) so a live
``LLM_PROVIDER`` toggle takes effect without a process restart and so a missing
credential never crashes import.
"""
from __future__ import annotations

from google.adk.agents import LlmAgent

from .budgeting_agent import build_budgeting_agent
from .context_agent import build_context_agent
from .education_agent import build_education_agent
from .model_resolver import adk_generate_content_config, resolve_adk_model
from .portfolio_agent import build_portfolio_agent

ROOT_INSTRUCTION = (
    "You are the orchestrator for a wealth assistant serving a Canadian bank. "
    "The active persona_id is '{persona_id}'. Profile: {persona_profile}.\n"
    "The client's stated goals/context so far: '{client_context}'.\n"
    "Always:\n"
    "1. Ground every number in a tool call (via a subagent). Never invent "
    "balances, rates, or performance figures.\n"
    "2. Route portfolio questions to portfolio_agent, budgeting/debt questions "
    "to budgeting_agent, education/market/advisor questions to education_agent, "
    "and goal/life-plan/planning-preference questions to context_agent.\n"
    "3. For complex questions (e.g. 'pay down debt or invest?'), gather from "
    "MULTIPLE subagents before answering.\n"
    "4. Tailor every answer to the client's stated context above when it is "
    "present; if it is empty, gently invite them to share their goals.\n"
    "5. For the affluent personas (affluent, affluent_no_goals), offer a warm "
    "handoff to a human advisor when volatility or complex planning is "
    "discussed.\n"
    "6. Match tone to persona: encouraging (first), reassuring (middle), "
    "premium/concise (affluent, affluent_no_goals)."
)


def build_root_agent() -> LlmAgent:
    return LlmAgent(
        name="wealth_root",
        model=resolve_adk_model(),
        generate_content_config=adk_generate_content_config(),
        instruction=ROOT_INSTRUCTION,
        sub_agents=[
            build_portfolio_agent(),
            build_budgeting_agent(),
            build_education_agent(),
            build_context_agent(),
        ],
    )
