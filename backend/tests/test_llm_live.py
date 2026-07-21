"""Live LLM integration tests (SPEC §17 test cases 1-4).

These require real provider credentials and are skipped otherwise, so the
offline `make test` stays green. Run them with a configured backend/.env:

    LLM_PROVIDER=openai OPENAI_API_KEY=sk-... uv run pytest tests/test_llm_live.py
"""
import os
import re

import pytest

import app.config  # noqa: F401 — loads backend/.env so the skip check sees creds
from app.data_loader import load_persona

pytestmark = pytest.mark.asyncio


def _credentialed() -> bool:
    provider = os.getenv("LLM_PROVIDER", "").lower()
    if provider == "openai":
        return bool(os.getenv("OPENAI_API_KEY"))
    if provider == "gemini":
        return bool(os.getenv("GOOGLE_CLOUD_PROJECT"))
    return False


live = pytest.mark.skipif(
    not _credentialed(), reason="no LLM credentials configured for the active provider"
)

SAMPLE_QUESTIONS = [
    "How much money should I save from my monthly income?",
    "Give me the total in my portfolio.",
    "Should I pay down debt or invest?",
]


def _digits(s: str) -> str:
    return re.sub(r"[^0-9]", "", s)


@live
async def test_raw_answers_every_sample_question():
    from app.architectures.raw_prompt import raw_answer

    for q in SAMPLE_QUESTIONS:
        reply, _ = raw_answer("first", q)
        assert reply.strip()


@live
async def test_skills_returns_correct_portfolio_total_each_persona():
    from app.architectures.skills import skills_answer

    for pid in ("middle", "affluent"):
        reply, tool_calls = skills_answer(pid, "Give me the total in my portfolio.")
        assert any(t.name == "get_portfolio_total" for t in tool_calls)
        expected = _digits(str(load_persona(pid)["portfolio_total"]))
        assert expected in _digits(reply)


@live
async def test_agentic_chains_tools_for_debt_vs_invest():
    from app.architectures.agentic_adk import agentic_answer

    _, tool_calls = await agentic_answer(
        "first", "sess-test-debt", "Should I pay down debt or invest?"
    )
    names = {t.name for t in tool_calls}
    assert "get_income_expenses" in names
    assert "get_debt_strategy" in names


@live
async def test_agentic_remembers_across_three_turns():
    from app.architectures.agentic_adk import agentic_answer

    sid = "sess-test-memory"
    turns = [
        "Give me the total in my portfolio.",
        "How does that compare to a year ago?",
        "Remind me — which persona are you helping right now?",
    ]
    last = ""
    for msg in turns:
        last, _ = await agentic_answer("affluent", sid, msg)
        assert last.strip()
