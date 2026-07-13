"""Architecture 3 — Agentic Application on Google ADK (SPEC §10).

Full agentic experience: a root orchestrator plans and routes to three
subagents (portfolio / budgeting / education), each of which calls grounded
tools. Session memory is retained across turns via ADK's session service, and
the tool trace is captured for the UI.

Provider awareness (SPEC §5 note): ADK is Gemini-native; when
``LLM_PROVIDER=openai`` the agents are built on a LiteLLM-wrapped model (see
``agents/model_resolver.py``). The active provider is baked into the agent tree
at build time, so we cache one root agent per provider and rebuild on toggle.
"""
from __future__ import annotations

import inspect

from ..data_loader import persona_summary
from ..llm_provider import ExecutedToolCall, current_provider_name
from ..agents.root_agent import build_root_agent
from ._insights import parse_insight_cards

APP_NAME = "wealth_insights_demo"

# Lazy, per-provider caches so a missing credential never breaks import and a
# live provider toggle rebuilds the agent tree.
_ROOT_CACHE: dict = {}
_RUNNER_CACHE: dict = {}
_SESSION_SERVICE = None


async def _maybe_await(value):
    if inspect.isawaitable(value):
        return await value
    return value


def _get_session_service():
    global _SESSION_SERVICE
    if _SESSION_SERVICE is None:
        from google.adk.sessions import InMemorySessionService

        _SESSION_SERVICE = InMemorySessionService()
    return _SESSION_SERVICE


def _get_runner():
    """One Runner per provider, sharing a single session service (memory)."""
    from google.adk.runners import Runner

    provider = current_provider_name()
    if provider not in _RUNNER_CACHE:
        if provider not in _ROOT_CACHE:
            _ROOT_CACHE[provider] = build_root_agent()
        _RUNNER_CACHE[provider] = Runner(
            app_name=APP_NAME,
            agent=_ROOT_CACHE[provider],
            session_service=_get_session_service(),
        )
    return _RUNNER_CACHE[provider]


async def _ensure_session(persona_id: str, session_id: str):
    svc = _get_session_service()
    existing = await _maybe_await(
        svc.get_session(app_name=APP_NAME, user_id=persona_id, session_id=session_id)
    )
    if existing is None:
        await _maybe_await(
            svc.create_session(
                app_name=APP_NAME,
                user_id=persona_id,
                session_id=session_id,
                state={
                    "persona_id": persona_id,
                    "persona_profile": persona_summary(persona_id),
                },
            )
        )


async def _run(persona_id: str, session_id: str, message: str):
    """Run one turn through the agent tree; return (final_text, tool_calls)."""
    from google.genai import types

    runner = _get_runner()
    await _ensure_session(persona_id, session_id)

    # A compact persona tag keeps tools grounded even on later turns; full
    # conversation history is retained by the session service (memory).
    tagged = f"[active persona_id: {persona_id}]\n{message}"
    content = types.Content(role="user", parts=[types.Part.from_text(text=tagged)])

    final_text = ""
    tool_calls: list[ExecutedToolCall] = []

    async for event in runner.run_async(
        user_id=persona_id, session_id=session_id, new_message=content
    ):
        content_obj = getattr(event, "content", None)
        if content_obj and content_obj.parts:
            for part in content_obj.parts:
                fc = getattr(part, "function_call", None)
                if fc:
                    tool_calls.append(
                        ExecutedToolCall(
                            name=fc.name, arguments=dict(fc.args or {})
                        )
                    )
                fr = getattr(part, "function_response", None)
                if fr:
                    _attach_result(tool_calls, fr.name, getattr(fr, "response", None))

        if event.is_final_response() and content_obj and content_obj.parts:
            final_text = "".join(p.text or "" for p in content_obj.parts if getattr(p, "text", None))

    return final_text, tool_calls


def _attach_result(tool_calls: list[ExecutedToolCall], name: str, response):
    for call in reversed(tool_calls):
        if call.name == name and call.result is None:
            # ADK wraps tool output; unwrap {"result": ...} when present.
            if isinstance(response, dict) and set(response.keys()) == {"result"}:
                call.result = response["result"]
            else:
                call.result = response
            return


async def agentic_answer(
    persona_id: str, session_id: str, question: str
) -> tuple[str, list[ExecutedToolCall]]:
    return await _run(persona_id, session_id, question)


async def agentic_insights(
    persona_id: str, session_id: str
) -> tuple[list[dict], list[ExecutedToolCall]]:
    """Proactive planning pass producing rich, grounded SCENARIO cards.

    Each scenario carries a short-term and long-term outlook, multiple weighed
    alternatives (one recommended) with tradeoffs, a recommended action with its
    projected impact, and a projection time-series that drives a comparison chart
    in the UI — all seeded from grounded subagent tool output.
    """
    prompt = (
        "Run a proactive planning pass for this persona. Inspect their profile "
        "and upcoming_events, delegate to the relevant subagents to fetch "
        "grounded numbers, then produce 2-3 personalised SCENARIO cards.\n"
        "Each scenario object must include:\n"
        '  "title", "body" (1-2 sentence situation),\n'
        '  "short_term" (next ~12 months) and "long_term" (~5+ years) outlooks,\n'
        '  "alternatives": an array of 2-3 {"label","detail","tradeoff",'
        '"recommended"(bool)} — exactly one recommended:true,\n'
        '  "recommended_action" and "recommended_impact" (e.g. "+$18k over 5 yrs"),\n'
        '  "projection": {"unit":"CAD","horizon_label":"5-year outlook",'
        '"series":[{"label":<alternative label>,"points":[{"t":"Y0","value":N},'
        '{"t":"Y1","value":N},...]}]} — one series per alternative, >=3 points '
        "each, seeded from the real starting figures you fetched,\n"
        '  "cta".\n'
        "Respond with ONLY the JSON array. Use REAL figures from the tools. No "
        "prose outside the JSON."
    )
    text, tool_calls = await _run(persona_id, session_id, prompt)
    return parse_insight_cards(text, kind="scenario", grounded=True), tool_calls
