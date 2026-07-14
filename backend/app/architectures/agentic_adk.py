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
import logging

from ..data_loader import persona_summary
from ..llm_provider import ExecutedToolCall, current_provider_name
from ..agents.root_agent import build_root_agent
from ._insights import parse_insight_cards

APP_NAME = "wealth_insights_demo"

log = logging.getLogger("wealth.agentic_adk")

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
                    # Seeded so {client_context} instruction placeholders always
                    # resolve; the context subagent overwrites these once the
                    # client shares (or declines to share) their goals.
                    "client_context": "",
                    "client_context_declined": False,
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


async def _run_with_retry(persona_id: str, session_id: str, message: str, attempts: int = 3):
    """Run a turn, retrying transient multi-agent failures.

    ADK's LLM-driven routing occasionally emits an invalid transfer (e.g. a
    sub-agent transferring to itself), which raises mid-run. Because routing is
    non-deterministic, simply re-running the turn almost always succeeds — so we
    retry a couple of times before letting the error surface to the caller.
    """
    last_exc: Exception | None = None
    for i in range(attempts):
        try:
            return await _run(persona_id, session_id, message)
        except Exception as exc:  # noqa: BLE001 — retry any transient run failure
            last_exc = exc
            log.warning("agentic run attempt %d/%d failed: %s", i + 1, attempts, exc)
    raise last_exc  # type: ignore[misc]


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
    return await _run_with_retry(persona_id, session_id, question)


async def read_session_context(persona_id: str, session_id: str) -> dict:
    """Return the collected-context slice of a session's memory ({} if none)."""
    svc = _get_session_service()
    session = await _maybe_await(
        svc.get_session(app_name=APP_NAME, user_id=persona_id, session_id=session_id)
    )
    state = getattr(session, "state", None) or {}
    return {
        "client_context": state.get("client_context", "") or "",
        "declined": bool(state.get("client_context_declined", False)),
    }


async def agentic_discovery(
    persona_id: str, session_id: str
) -> tuple[dict, list[ExecutedToolCall]]:
    """Ask the context subagent for a discovery question + scenario options.

    If the client already shared context in this session, no discovery is needed.
    """
    stored = await read_session_context(persona_id, session_id)
    if stored["client_context"]:
        return (
            {
                "needs_context": False,
                "question": "",
                "options": [],
                "stored_context": stored["client_context"],
            },
            [],
        )

    prompt = (
        "DISCOVERY: produce one concise question inviting me to share my main "
        "financial goal, plus 4-6 concrete life-goal scenario options tailored to "
        'my profile. Respond with ONLY JSON {"question":"...","options":["...",'
        '"..."]}. No prose outside the JSON.'
    )
    text, tool_calls = await _run_with_retry(persona_id, session_id, prompt)
    parsed = _parse_discovery(text)
    return (
        {
            "needs_context": True,
            "question": parsed["question"],
            "options": parsed["options"],
            "stored_context": None,
        },
        tool_calls,
    )


async def agentic_save_context(
    persona_id: str, session_id: str, answer: str, declined: bool
) -> tuple[dict, list[ExecutedToolCall]]:
    """Persist the client's answer to memory and get a follow-up question back."""
    if declined:
        message = (
            "The client DECLINED to share specific goals (they skipped). Call "
            "save_client_context with a brief note and declined=true, then reply "
            "with ONE short, low-pressure follow-up question."
        )
    else:
        message = (
            f"The client shared this goal/context: \"{answer}\". Call "
            "save_client_context to save a short normalized summary (declined=false), "
            "then reply with ONE short follow-up question to sharpen the advice."
        )
    follow_up, tool_calls = await _run_with_retry(persona_id, session_id, message)
    stored = await read_session_context(persona_id, session_id)
    return (
        {
            "follow_up": follow_up.strip(),
            "stored_context": stored["client_context"],
            "declined": stored["declined"],
        },
        tool_calls,
    )


async def agentic_clear_memory(persona_id: str, session_id: str) -> None:
    """Wipe this session's memory so discovery restarts (safe if absent)."""
    svc = _get_session_service()
    await _maybe_await(
        svc.delete_session(
            app_name=APP_NAME, user_id=persona_id, session_id=session_id
        )
    )


async def agentic_insights(
    persona_id: str, session_id: str
) -> tuple[list[dict], list[ExecutedToolCall]]:
    """Proactive planning pass producing rich, grounded SCENARIO cards.

    Tailored to the client's collected context (from session memory). If the client
    declined to share goals, the model instead assumes scenarios from their profile
    and states those assumptions on each card.
    """
    stored = await read_session_context(persona_id, session_id)
    ctx, declined = stored["client_context"], stored["declined"]

    if declined:
        context_line = (
            "The client DECLINED to share specific goals. Make reasonable "
            "assumptions from their profile (age, risk, goals) and, for EACH card, "
            'add an "assumptions" array of 1-2 short strings stating exactly what '
            "you assumed. Then build the scenario around those assumptions.\n"
        )
    elif ctx:
        context_line = (
            f"The client's stated goal/context is: \"{ctx}\". Tailor EVERY scenario "
            "directly to it.\n"
        )
    else:
        context_line = ""

    prompt = (
        "Run a proactive planning pass for this persona. Inspect their profile "
        "and upcoming_events, delegate to the relevant subagents to fetch "
        "grounded numbers, then produce 2-3 personalised SCENARIO cards.\n"
        f"{context_line}"
        "Each scenario object must include:\n"
        '  "title", "body" (1-2 sentence situation),\n'
        '  "assumptions": array of short strings (ONLY when the client declined to '
        "share goals; otherwise omit or use []),\n"
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
    text, tool_calls = await _run_with_retry(persona_id, session_id, prompt)
    return parse_insight_cards(text, kind="scenario", grounded=True), tool_calls


def _parse_discovery(text: str) -> dict:
    """Best-effort extraction of the discovery {question, options} JSON."""
    try:
        start = text.index("{")
        end = text.rindex("}") + 1
        obj = json.loads(text[start:end])
        question = str(obj.get("question", "")).strip()
        options = [str(o).strip() for o in obj.get("options", []) if str(o).strip()]
        if question or options:
            return {
                "question": question or "What's your main financial goal right now?",
                "options": options[:6],
            }
    except (ValueError, json.JSONDecodeError):
        pass
    return {
        "question": "What's your main financial goal right now?",
        "options": [
            "Retire early",
            "Buy a home",
            "Fund education",
            "Grow wealth",
        ],
    }
