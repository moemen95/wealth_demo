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


def test_clean_follow_up_stops_on_enough():
    from app.architectures.agentic_adk import _clean_follow_up

    assert _clean_follow_up("ENOUGH") == ""
    assert _clean_follow_up("ENOUGH.") == ""
    assert _clean_follow_up("None") == ""
    assert _clean_follow_up("I think I have enough now") == ""  # no question mark
    assert _clean_follow_up("What is your target retirement age?") == (
        "What is your target retirement age?"
    )


def test_scenarios_carry_follow_up_questions():
    from app.architectures.agentic_adk import _build_scenarios_and_analysis

    obj = {
        "metric": "portfolio_value",
        "horizon_years": 10,
        "scenarios": [
            {"title": "A", "annual_return": 0.04,
             "follow_up_questions": ["How risky is this?", "  ", "What if markets drop?"]},
            {"title": "B", "annual_return": 0.06},
            {"title": "C", "annual_return": 0.08, "follow_up_questions": ["Can I retire earlier?"]},
        ],
    }
    cards, _ = _build_scenarios_and_analysis("affluent", json.dumps(obj), declined=False)
    assert cards[0]["follow_up_questions"] == ["How risky is this?", "What if markets drop?"]
    assert cards[1]["follow_up_questions"] is None
    assert cards[2]["follow_up_questions"] == ["Can I retire earlier?"]


def test_analysis_has_grounded_chart_explanation():
    from app.architectures.agentic_adk import _build_scenarios_and_analysis

    obj = {
        "metric": "portfolio_value",
        "metric_label": "Portfolio value",
        "horizon_years": 15,
        "scenarios": [
            {"title": "Conservative", "annual_return": 0.035},
            {"title": "Balanced", "annual_return": 0.06},
            {"title": "Growth", "annual_return": 0.085},
        ],
    }
    _, analysis = _build_scenarios_and_analysis("affluent", json.dumps(obj), declined=False)
    exp = analysis["chart_explanation"]
    assert exp and "15 years" in exp
    # Names the best and worst scenario, and reads off the same numbers the chart plots.
    assert "Growth" in exp and "Conservative" in exp
    best = max(analysis["summary"], key=lambda r: r["final_value"])
    assert f"${best['final_value']:,.0f}" in exp


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


# --- Intelligent context handling: declined + merge + no re-asking -----------
#
# The context subagent's LLM used to decide `declined` itself and mislabeled any
# negative-but-informative answer ("I don't want risk", "no kids") as a refusal,
# and it re-asked for things already shared. The frontend is authoritative about
# whether the client actually skipped, so we correct the persisted flags and feed
# known context into the prompt. These tests lock that behaviour in without a live
# LLM by faking the agent run.


async def _create_session(sid, user="affluent", **state):
    svc = agentic_adk._get_session_service()
    base = {"client_context": "", "client_context_declined": False, "context_log": []}
    base.update(state)
    await agentic_adk._maybe_await(
        svc.create_session(
            app_name=agentic_adk.APP_NAME, user_id=user, session_id=sid, state=base
        )
    )
    return svc


@pytest.mark.asyncio
async def test_persist_context_flags_overrides_declined_and_log():
    sid = "persist-override-1"
    await _create_session(
        sid,
        client_context="retire at 60, avoid risk",
        client_context_declined=True,
        context_log=[{"context": "retire at 60, avoid risk", "declined": True}],
    )
    await agentic_adk._persist_context_flags("affluent", sid, declined=False)
    ctx = await agentic_adk.read_session_context("affluent", sid)
    mem = await agentic_adk.read_session_memory("affluent", sid)
    assert ctx["declined"] is False
    assert mem["entries"][-1]["declined"] is False
    assert ctx["client_context"] == "retire at 60, avoid risk"  # content preserved


@pytest.mark.asyncio
async def test_negative_answer_is_not_marked_declined(monkeypatch):
    """A typed negative answer must never be recorded as a refusal, even when the
    LLM wrongly guesses declined=true."""
    sid = "neg-answer-1"

    async def fake_run(persona_id, session_id, message):
        # The fake agent mislabels the negative answer as a decline — the bug.
        svc = agentic_adk._get_session_service()
        await agentic_adk._maybe_await(
            svc.create_session(
                app_name=agentic_adk.APP_NAME,
                user_id=persona_id,
                session_id=session_id,
                state={
                    "client_context": "wants to avoid risky investments",
                    "client_context_declined": True,  # LLM's wrong guess
                    "context_log": [
                        {"context": "wants to avoid risky investments", "declined": True}
                    ],
                },
            )
        )
        return ("ENOUGH", [])

    monkeypatch.setattr(agentic_adk, "_run_with_retry", fake_run)
    res, _ = await agentic_adk.agentic_save_context(
        "affluent", sid, "I don't want risky investments", declined=False
    )
    assert res["declined"] is False  # corrected
    assert res["stored_context"] == "wants to avoid risky investments"
    mem = await agentic_adk.read_session_memory("affluent", sid)
    assert mem["entries"][-1]["declined"] is False


@pytest.mark.asyncio
async def test_save_context_prompt_surfaces_known_and_forbids_reasking(monkeypatch):
    sid = "reask-1"
    await _create_session(sid, client_context="retire at 62; tax-efficient income")
    captured = {}

    async def fake_run(persona_id, session_id, message):
        captured["message"] = message
        return ("ENOUGH", [])

    monkeypatch.setattr(agentic_adk, "_run_with_retry", fake_run)
    res, _ = await agentic_adk.agentic_save_context(
        "affluent", sid, "no children", declined=False
    )
    msg = captured["message"]
    assert "retire at 62; tax-efficient income" in msg  # known context surfaced
    assert "do NOT ask about any of this again" in msg  # anti-re-ask directive
    assert "no children" in msg  # the (negative) answer is passed through
    assert "never as a refusal" in msg  # negatives framed as information
    assert res["declined"] is False
    assert res["follow_up"] == ""  # ENOUGH normalized to no question


@pytest.mark.asyncio
async def test_skip_after_sharing_keeps_context_and_not_declined(monkeypatch):
    """Skipping a follow-up after already sharing a goal must preserve the earlier
    context and stay declined=false."""
    sid = "skip-after-1"
    await _create_session(
        sid,
        client_context="buy a vacation home in 5 years",
        context_log=[{"context": "buy a vacation home in 5 years", "declined": False}],
    )

    async def fake_run(persona_id, session_id, message):
        # Emulate a bad save that blanks context and declines on the skip.
        from google.adk.events import Event, EventActions

        svc = agentic_adk._get_session_service()
        sess = await agentic_adk._maybe_await(
            svc.get_session(
                app_name=agentic_adk.APP_NAME, user_id=persona_id, session_id=session_id
            )
        )
        await agentic_adk._maybe_await(
            svc.append_event(
                sess,
                Event(
                    author="a",
                    actions=EventActions(
                        state_delta={"client_context": "", "client_context_declined": True}
                    ),
                ),
            )
        )
        return ("ENOUGH", [])

    monkeypatch.setattr(agentic_adk, "_run_with_retry", fake_run)
    res, _ = await agentic_adk.agentic_save_context("affluent", sid, "", declined=True)
    assert res["declined"] is False  # already had context
    assert res["stored_context"] == "buy a vacation home in 5 years"  # restored


@pytest.mark.asyncio
async def test_first_turn_skip_is_declined(monkeypatch):
    sid = "skip-first-1"

    async def fake_run(persona_id, session_id, message):
        svc = agentic_adk._get_session_service()
        await agentic_adk._maybe_await(
            svc.create_session(
                app_name=agentic_adk.APP_NAME,
                user_id=persona_id,
                session_id=session_id,
                state={
                    "client_context": "",
                    "client_context_declined": True,
                    "context_log": [{"context": "", "declined": True}],
                },
            )
        )
        return ("ENOUGH", [])

    monkeypatch.setattr(agentic_adk, "_run_with_retry", fake_run)
    res, _ = await agentic_adk.agentic_save_context("affluent", sid, "", declined=True)
    assert res["declined"] is True  # nothing was ever shared
