"""Architecture 1 — Raw Prompting (SPEC §8).

The baseline. Everything is stuffed into the prompt; the LLM has NO tools and no
structured grounding. On purpose this surfaces the failure modes:
  * hallucinated portfolio numbers,
  * generic savings advice unrelated to real income,
  * no ability to take action, no memory beyond the context window.

We deliberately give the model only a light persona *label* (life stage) and
NOT the financial data — that is the whole point of the "before" picture.
"""
from __future__ import annotations

import json

from ..data_loader import load_persona
from ..llm_provider import ExecutedToolCall, get_provider

SYSTEM_PROMPT = (
    "You are a helpful wealth assistant for a Canadian bank. "
    "You are speaking with {persona}. Answer helpfully and concisely."
)


def _persona_label(persona_id: str) -> str:
    p = load_persona(persona_id)
    return f"{p['name']} ({p.get('tagline', 'a customer')})"


def raw_answer(persona_id: str, question: str) -> tuple[str, list[ExecutedToolCall]]:
    provider = get_provider()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(persona=_persona_label(persona_id))},
        {"role": "user", "content": question},
    ]
    return provider.complete(messages), []


def raw_insights(persona_id: str) -> tuple[list[dict], list[ExecutedToolCall]]:
    provider = get_provider()
    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT.format(persona=_persona_label(persona_id)),
        },
        {
            "role": "user",
            "content": (
                "Proactively surface 2-3 short financial insight cards for me. "
                'Respond with ONLY a JSON array of objects like '
                '[{"title": "...", "body": "...", "cta": "..."}]. No prose.'
            ),
        },
    ]
    text = provider.complete(messages)
    return _parse_insight_json(text), []


def _parse_insight_json(text: str) -> list[dict]:
    """Best-effort extraction of the insight JSON array from a model reply."""
    try:
        start = text.index("[")
        end = text.rindex("]") + 1
        data = json.loads(text[start:end])
        out = []
        for item in data[:3]:
            out.append(
                {
                    "title": str(item.get("title", "Insight")),
                    "body": str(item.get("body", "")),
                    "cta": str(item.get("cta", "Learn more")),
                }
            )
        if out:
            return out
    except (ValueError, json.JSONDecodeError):
        pass
    # Fallback so the UI always renders something.
    return [
        {
            "title": "General guidance",
            "body": text.strip()[:280] or "No structured insights returned.",
            "cta": "Ask a question",
        }
    ]
