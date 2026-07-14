"""Context subagent — discovers the client's goals and life plans.

Unlike the domain subagents (portfolio / budgeting / education), this agent's job is
to *gather* context, not answer money questions. It proposes a discovery question with
scenario options, and when the client answers it persists the answer to session memory
via ``save_client_context`` so the rest of the tree (and the insights generator) can
tailor advice. This is what makes the Agentic architecture "ask before advising".
"""
from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

from .context_tools import save_client_context
from .model_resolver import resolve_adk_model


def build_context_agent() -> LlmAgent:
    return LlmAgent(
        name="context_agent",
        model=resolve_adk_model(),
        description=(
            "Discovers the client's goals, life plans, and planning preferences; "
            "asks clarifying questions and saves the answers to memory."
        ),
        instruction=(
            "You gather goals and context for persona_id '{persona_id}'. "
            "Profile: {persona_profile}. Known context so far: '{client_context}'.\n"
            "MODE 1 — if asked to produce a DISCOVERY question: respond with ONLY a "
            'JSON object {"question": "...", "options": ["...", "..."]} — one short '
            "question inviting the client to share their main goal, plus 4-6 concrete "
            "life-goal scenarios tailored to this persona (e.g. 'Retire early', "
            "'Buy a home', 'Fund children's education', 'Start a business'). No prose "
            "outside the JSON.\n"
            "MODE 2 — if given the client's ANSWER: call save_client_context with a "
            "short normalized summary of their goal (set declined=true if they "
            "skipped or refused), then reply with ONE brief follow-up question that "
            "would further sharpen the advice. Keep it to a single sentence."
        ),
        tools=[FunctionTool(save_client_context)],
    )
