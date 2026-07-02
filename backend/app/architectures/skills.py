"""Architecture 2 — Raw Prompting with Skills (SPEC §9).

Introduces structured tools the LLM can call. This FIXES grounding (portfolio
totals, budgets come from real data) but stays single-shot: one tool round per
turn, no planning, no memory. Complex questions still get shallow answers.

Flow (per SPEC §9):
  1) Ask the model which skill (if any) to call — via the provider layer
     (OpenAI ``tools`` / Gemini ``function_declarations``).
  2) Execute the skill.
  3) Feed the result back to the model to finalise the answer.
"""
from __future__ import annotations

import json

from ..data_loader import persona_summary
from ..llm_provider import ExecutedToolCall, get_provider
from ..skills import SKILL_SCHEMAS, execute_skill

SYSTEM_PROMPT = (
    "You are a wealth assistant for a Canadian bank. The active persona_id is "
    "'{persona_id}'. Profile: {summary}.\n"
    "You have skills (tools) that return GROUNDED data. Whenever the user asks "
    "about balances, portfolio value, allocation, performance, income, savings, "
    "debt, or markets, you MUST call the relevant skill and pass persona_id="
    "'{persona_id}'. Never invent numbers. Keep answers concise."
)


def _system(persona_id: str) -> str:
    return SYSTEM_PROMPT.format(persona_id=persona_id, summary=persona_summary(persona_id))


def skills_answer(persona_id: str, question: str) -> tuple[str, list[ExecutedToolCall]]:
    provider = get_provider()
    messages = [
        {"role": "system", "content": _system(persona_id)},
        {"role": "user", "content": question},
    ]
    result = provider.run_with_tools(
        messages, SKILL_SCHEMAS, execute_skill, max_rounds=1
    )
    return result.text, result.tool_calls


def skills_insights(persona_id: str) -> tuple[list[dict], list[ExecutedToolCall]]:
    provider = get_provider()
    messages = [
        {"role": "system", "content": _system(persona_id)},
        {
            "role": "user",
            "content": (
                "Proactively surface 2-3 short, GROUNDED insight cards for me. "
                "Call skills to fetch real numbers first, then respond with ONLY "
                'a JSON array like [{"title":"...","body":"...","cta":"..."}]. '
                "Put real figures in the body. No prose outside the JSON."
            ),
        },
    ]
    result = provider.run_with_tools(
        messages, SKILL_SCHEMAS, execute_skill, max_rounds=1
    )
    return _parse_insight_json(result.text), result.tool_calls


def _parse_insight_json(text: str) -> list[dict]:
    try:
        start = text.index("[")
        end = text.rindex("]") + 1
        data = json.loads(text[start:end])
        out = [
            {
                "title": str(i.get("title", "Insight")),
                "body": str(i.get("body", "")),
                "cta": str(i.get("cta", "Learn more")),
            }
            for i in data[:3]
        ]
        if out:
            return out
    except (ValueError, json.JSONDecodeError):
        pass
    return [
        {
            "title": "Grounded insight",
            "body": text.strip()[:280] or "No structured insights returned.",
            "cta": "Ask a question",
        }
    ]
