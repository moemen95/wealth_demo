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
import json

from ..data_loader import persona_summary
from ..llm_provider import ExecutedToolCall, current_provider_name
from ..agents.root_agent import build_root_agent

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
    """Proactive planning pass: inspect the profile + upcoming_events and
    delegate to subagents to produce 2-3 personalised insight cards."""
    prompt = (
        "Run a proactive planning pass for this persona. Inspect their profile "
        "and upcoming_events, delegate to the relevant subagents to fetch "
        "grounded numbers, then produce 2-3 personalised insight cards. "
        'Respond with ONLY a JSON array like '
        '[{"title":"...","body":"...","cta":"..."}] — put real figures in the '
        "body. No prose outside the JSON."
    )
    text, tool_calls = await _run(persona_id, session_id, prompt)
    return _parse_insight_json(text), tool_calls


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
            "title": "Personalised insight",
            "body": text.strip()[:280] or "No structured insights returned.",
            "cta": "Ask a question",
        }
    ]
