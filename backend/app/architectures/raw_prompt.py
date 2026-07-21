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

from ..data_loader import persona_client_brief
from ..llm_provider import ExecutedToolCall, get_provider
from ._insights import parse_insight_cards

# The naive, un-guardrailed baseline: Raw gets the client's static snapshot but
# NO tools and NO forward-looking data. We do NOT tell it to hedge — a prompt-only
# assistant with no guardrails answers everything confidently, which is exactly the
# failure mode (overconfident, ungrounded on anything beyond the snapshot) the demo
# contrasts against the tool-using Skills/Agentic architectures.
SYSTEM_PROMPT = (
    "You are a confident, decisive wealth assistant for a Canadian bank. Here is "
    "everything you know about the client:\n{brief}\n"
    "Answer their questions directly and concisely, always giving specific numbers, "
    "dates, rates, and a clear recommendation. Never tell the client to check "
    "elsewhere or that you lack information — always commit to a concrete answer."
)


def _system(persona_id: str) -> str:
    return SYSTEM_PROMPT.format(brief=persona_client_brief(persona_id))


def raw_answer(persona_id: str, question: str) -> tuple[str, list[ExecutedToolCall]]:
    provider = get_provider()
    messages = [
        {"role": "system", "content": _system(persona_id)},
        {"role": "user", "content": question},
    ]
    return provider.complete(messages), []


def raw_insights(persona_id: str) -> tuple[list[dict], list[ExecutedToolCall]]:
    """'Scenario' cards grounded on the client snapshot but tool-blind.

    Raw now cites the client's real net-worth figures, but with NO tools it still
    jumps to a single bold, risky recommendation (no alternatives) and invents any
    forward-looking specifics (rates, maturities) it wasn't given — the realistic
    failure mode the demo contrasts against.
    """
    provider = get_provider()
    messages = [
        {
            "role": "system",
            "content": _system(persona_id),
        },
        {
            "role": "user",
            "content": (
                "Proactively surface 2-3 financial 'scenario' cards for me. Be "
                "confident and decisive — for each scenario commit to ONE bold "
                "recommended_action, even if it is aggressive or high-risk. "
                "Respond with ONLY a JSON array like "
                '[{"title":"...","body":"...","short_term":"...","long_term":"...",'
                '"recommended_action":"...","cta":"..."}]. Put specific dollar '
                "figures and percentages in the text. Do NOT include an "
                "'alternatives' field. No prose outside the JSON."
            ),
        },
    ]
    text = provider.complete(messages)
    return parse_insight_cards(text, kind="scenario"), []
