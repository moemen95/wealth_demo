"""Offline tests for the agentic context/memory plumbing (no live LLM)."""
import json

import pytest

from app.agents.context_tools import save_client_context
from app.architectures import agentic_adk
from app.architectures._insights import parse_insight_cards
from app.models.schemas import Insight


class _FakeToolContext:
    def __init__(self):
        self.state = {}


def test_save_client_context_writes_state():
    tc = _FakeToolContext()
    out = save_client_context("retire at 55", declined=False, tool_context=tc)
    assert out == {"saved": True, "context": "retire at 55", "declined": False}
    assert tc.state["client_context"] == "retire at 55"
    assert tc.state["client_context_declined"] is False


def test_save_client_context_declined():
    tc = _FakeToolContext()
    save_client_context("", declined=True, tool_context=tc)
    assert tc.state["client_context_declined"] is True


def test_save_client_context_accumulates_log():
    tc = _FakeToolContext()
    save_client_context("retire at 55", tool_context=tc)
    save_client_context("retire at 55, fund kids' school", tool_context=tc)
    save_client_context("", declined=True, tool_context=tc)
    log = tc.state["context_log"]
    assert [e["context"] for e in log] == [
        "retire at 55",
        "retire at 55, fund kids' school",
        "",
    ]
    assert log[-1]["declined"] is True
    # The active context is always the latest saved value.
    assert tc.state["client_context"] == ""


def test_scenario_assumptions_are_parsed():
    text = json.dumps([{"title": "T", "body": "B",
                        "assumptions": ["assume retirement at 60", "moderate risk"]}])
    card = parse_insight_cards(text, kind="scenario", grounded=True)[0]
    assert card["assumptions"] == ["assume retirement at 60", "moderate risk"]
    Insight(**card)  # must satisfy the API contract


def test_discovery_parser_fallback_and_success():
    fb = agentic_adk._parse_discovery("no json here")
    assert fb["question"] and len(fb["options"]) >= 2
    ok = agentic_adk._parse_discovery('x {"question":"Q?","options":["a","b","c"]} y')
    assert ok["question"] == "Q?"
    assert ok["options"] == ["a", "b", "c"]


@pytest.mark.asyncio
async def test_clear_memory_is_noop_when_absent():
    # Deleting a session that was never created must not raise.
    await agentic_adk.agentic_clear_memory("middle", "nonexistent-session-xyz")
