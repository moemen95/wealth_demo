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


async def _persist_context_flags(
    persona_id: str,
    session_id: str,
    *,
    declined: bool,
    client_context: str | None = None,
) -> None:
    """Deterministically correct the persisted context flags after an agent run.

    The context subagent's LLM is unreliable at deciding ``declined`` — it tends to
    mislabel negative-but-informative answers ("I don't want risk", "no kids", "I'm
    worried about a downturn") as a refusal. But the frontend already knows the truth:
    ``declined`` is true only when the client clicked *Skip*. So we treat the frontend
    value as authoritative and overwrite whatever the LLM stored, using an ADK
    state-delta event (the supported way to mutate session state out of band).
    """
    svc = _get_session_service()
    session = await _maybe_await(
        svc.get_session(app_name=APP_NAME, user_id=persona_id, session_id=session_id)
    )
    if session is None:
        return
    state = getattr(session, "state", None) or {}
    delta: dict = {"client_context_declined": bool(declined)}
    if client_context is not None:
        delta["client_context"] = client_context
    # Correct the last log entry's declined flag too, so the memory panel matches.
    log = list(state.get("context_log", []))
    if log and isinstance(log[-1], dict):
        log[-1] = {**log[-1], "declined": bool(declined)}
        delta["context_log"] = log

    from google.adk.events import Event, EventActions

    event = Event(author="system", actions=EventActions(state_delta=delta))
    await _maybe_await(svc.append_event(session, event))


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


async def read_session_memory(persona_id: str, session_id: str) -> dict:
    """Return the full agentic memory for the UI: the active tailoring context,
    the declined flag, and the append-only log of every answer saved this session.
    """
    svc = _get_session_service()
    session = await _maybe_await(
        svc.get_session(app_name=APP_NAME, user_id=persona_id, session_id=session_id)
    )
    state = getattr(session, "state", None) or {}
    entries = [
        {"context": str(e.get("context", "")), "declined": bool(e.get("declined", False))}
        for e in (state.get("context_log") or [])
        if isinstance(e, dict)
    ]
    return {
        "client_context": state.get("client_context", "") or "",
        "declined": bool(state.get("client_context_declined", False)),
        "entries": entries,
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


def _clean_follow_up(text: str) -> str:
    """Return the follow-up question, or '' when the agent signals it has enough.

    The context agent replies ``ENOUGH`` when it doesn't need more context; we also
    treat a reply with no question mark (i.e. not actually a question) as a stop.
    """
    t = (text or "").strip()
    if not t:
        return ""
    # The agent sometimes replies with a whole discovery JSON object
    # ({"question": "...", "options": [...]}) instead of a plain follow-up
    # sentence. Pull the question out rather than dumping raw JSON into the UI.
    if "{" in t and '"question"' in t:
        try:
            obj = json.loads(t[t.index("{") : t.rindex("}") + 1])
            q = str(obj.get("question", "")).strip()
            if q:
                t = q
        except (ValueError, json.JSONDecodeError):
            pass
    # Strip a leading ENOUGH token / stop signal.
    if t.upper().startswith("ENOUGH") or t.upper() == "NONE":
        return ""
    if "?" not in t:
        return ""
    return t


async def agentic_save_context(
    persona_id: str, session_id: str, answer: str, declined: bool
) -> tuple[dict, list[ExecutedToolCall]]:
    """Persist the client's answer to memory and get a follow-up question back.

    The follow-up is optional: the context agent replies ``ENOUGH`` once it has
    sufficient context, which we normalize to an empty string so the UI stops
    asking (a hard cap on the frontend backs this up).

    ``declined`` is authoritative from the frontend (true only when the client hit
    *Skip*); we persist that value ourselves rather than trusting the LLM's guess, so
    an informative-but-negative answer is never mislabeled as a refusal.
    """
    before = await read_session_context(persona_id, session_id)
    known = before["client_context"].strip()
    known_line = (
        f"Already known about this client (do NOT ask about any of this again): "
        f"\"{known}\".\n"
        if known
        else "Nothing is known about this client yet.\n"
    )

    if declined:
        message = (
            known_line
            + "The client clicked SKIP — they chose not to answer THIS question. "
            "That is fine and does NOT erase what's already known. Call "
            "save_client_context to re-save the existing known context unchanged "
            "(declined=true only if nothing at all is known yet). Do not push — "
            "reply with exactly ENOUGH."
        )
    else:
        message = (
            known_line
            + f'The client just answered: "{answer}". This is real context even if '
            "it is a negative, a concern, or a constraint (e.g. wanting to avoid "
            "risk, having no children, worrying about a downturn) — treat it as "
            "information, never as a refusal. Call save_client_context with "
            "declined=false and a summary that MERGES this answer with everything "
            "already known into one cumulative sentence (keep all prior facts). "
            "Then ask ONE short follow-up about something genuinely still missing "
            "and not listed above, or reply with exactly ENOUGH if you have enough."
        )
    follow_up, tool_calls = await _run_with_retry(persona_id, session_id, message)
    follow_up = _clean_follow_up(follow_up)
    # Deterministic, LLM-proof flags. We've only truly "declined" when the client
    # skipped AND nothing was ever collected — skipping a follow-up after already
    # sharing a goal keeps the earlier context intact and declined=false. A typed
    # answer (however negative) is never a decline.
    declined_final = bool(declined) and not known
    if declined:
        # A skip must never erase or rewrite previously collected context.
        await _persist_context_flags(
            persona_id, session_id, declined=declined_final, client_context=known
        )
    else:
        await _persist_context_flags(persona_id, session_id, declined=declined_final)
    stored = await read_session_context(persona_id, session_id)
    return (
        {
            "follow_up": follow_up,
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


_METRIC_LABELS = {
    "portfolio_value": "Projected portfolio value",
    "annual_income": "Projected annual income",
    "after_tax_value": "Projected after-tax value",
}


async def agentic_insights(
    persona_id: str, session_id: str
) -> tuple[list[dict], dict | None, list[ExecutedToolCall]]:
    """Proactive planning pass producing SCENARIO cards + a comparison analysis.

    The LLM proposes 2-3 goal-tailored scenarios (narrative + recommended action +
    an assumed annual return & monthly contribution) and picks the comparison
    metric. The projected outcomes that drive the comparison chart are then computed
    DETERMINISTICALLY in Python (``project_strategy``) — never by the LLM — so the
    chart is accurate. Returns (cards, analysis, tool_calls).
    """
    stored = await read_session_context(persona_id, session_id)
    ctx, declined = stored["client_context"], stored["declined"]

    if declined:
        context_line = (
            "The client DECLINED to share specific goals. Make reasonable "
            "assumptions from their profile (age, risk, goals) and, for EACH "
            'scenario, add an "assumptions" array of 1-2 short strings stating '
            "exactly what you assumed.\n"
        )
    elif ctx:
        context_line = (
            f"The client's stated goal/context is: \"{ctx}\". Tailor EVERY scenario "
            "directly to it.\n"
        )
    else:
        context_line = ""

    prompt = (
        "Run a proactive planning pass for this persona. Inspect their profile and "
        "upcoming_events, delegate to subagents for grounded numbers, then propose "
        "exactly 3 goal-tailored investment SCENARIOS to compare.\n"
        f"{context_line}"
        "Respond with ONLY a JSON OBJECT (no prose) of this shape:\n"
        "{\n"
        '  "metric": "portfolio_value" | "annual_income" | "after_tax_value",\n'
        '  "metric_label": "<short axis label matching the metric>",\n'
        '  "horizon_years": <integer 5-20>,\n'
        '  "withdrawal_rate": <0.02-0.08, only relevant if metric=annual_income>,\n'
        '  "tax_rate": <0.0-0.5, only relevant if metric=after_tax_value>,\n'
        '  "recommended_scenario": "<title of the single best scenario>",\n'
        '  "recommendation_rationale": "<1-2 sentences on why it fits best>",\n'
        '  "comparison_summary": "<1-2 sentences comparing the three>",\n'
        '  "scenarios": [ {\n'
        '     "title": "...", "body": "1-2 sentence situation",\n'
        '     "short_term": "<1 sentence: what to focus on in the next ~12 months '
        'for this scenario>",\n'
        '     "long_term": "<1 sentence: what to focus on over ~5+ years for this '
        'scenario>",\n'
        '     "recommended_action": "the one action to take",\n'
        '     "assumptions": ["..."]  (ONLY when the client declined; else []),\n'
        '     "annual_return": <0.0-0.12 nominal return for this strategy>,\n'
        '     "monthly_contribution": <CAD/month the client will still ADD; use the '
        "real surplus for someone saving, but 0 for a retiree/near-retiree who is "
        'drawing income rather than contributing>,\n'
        '     "follow_up_questions": ["...","..."]  (2-3 short, specific questions '
        "THIS client would likely ask about THIS scenario, in first person)\n"
        "  } ]  (exactly 3, each with a DIFFERENT strategy/return)\n"
        "}\n"
        "Pick the metric that best fits the goal: for a RETIREMENT-INCOME or "
        "capital-preservation goal use metric='annual_income' (it is modelled as a "
        "sustainable drawdown from the portfolio — the client does NOT contribute, so "
        "set monthly_contribution=0 and choose a realistic withdrawal_rate ~0.03-0.05). "
        "Use metric='portfolio_value' only for someone still accumulating. Choose each "
        "scenario's annual_return to reflect its risk (conservative vs growth). Use "
        "REAL figures from the tools for balances and surplus."
    )
    text, tool_calls = await _run_with_retry(persona_id, session_id, prompt)
    cards, analysis = _build_scenarios_and_analysis(
        persona_id, text, declined=declined
    )
    return cards, analysis, tool_calls


def _build_scenarios_and_analysis(
    persona_id: str, text: str, *, declined: bool
) -> tuple[list[dict], dict | None]:
    """Parse the agentic JSON object → scenario cards + a computed comparison.

    Falls back to the tolerant array parser if the model didn't return the object
    shape, so the UI always renders something.
    """
    from ..skills.projection import project_strategy

    obj = _parse_agentic_object(text)
    if obj is None:
        return parse_insight_cards(text, kind="scenario", grounded=True), None

    metric = obj.get("metric", "portfolio_value")
    if metric not in _METRIC_LABELS:
        metric = "portfolio_value"
    horizon_years = obj.get("horizon_years", 10)
    withdrawal_rate = obj.get("withdrawal_rate", 0.04)
    tax_rate = obj.get("tax_rate", 0.0)
    raw_scenarios = [s for s in (obj.get("scenarios") or []) if isinstance(s, dict)][:3]

    # The comparison is only meaningful if the scenarios use DIFFERENT returns.
    # Honor the agent's returns when they're distinct; otherwise spread them across
    # a conservative→growth ladder so the three lines actually diverge.
    def _num(x):
        try:
            return round(float(x), 4)
        except (TypeError, ValueError):
            return None

    provided = [_num(sc.get("annual_return")) for sc in raw_scenarios]
    distinct = {r for r in provided if r is not None}
    _ladder = [0.035, 0.06, 0.085]
    use_ladder = len(distinct) < len(raw_scenarios) or len(distinct) < 2

    cards: list[dict] = []
    series: list[dict] = []
    summary: list[dict] = []
    for i, sc in enumerate(raw_scenarios):
        title = str(sc.get("title") or "Scenario").strip()
        annual_return = (
            _ladder[min(i, len(_ladder) - 1)]
            if use_ladder or provided[i] is None
            else provided[i]
        )
        try:
            proj = project_strategy(
                persona_id,
                annual_return=annual_return,
                monthly_contribution=(
                    float(sc["monthly_contribution"])
                    if sc.get("monthly_contribution") is not None
                    else None
                ),
                years=int(horizon_years),
                metric=metric,
                withdrawal_rate=float(withdrawal_rate),
                tax_rate=float(tax_rate),
            )
        except (TypeError, ValueError):
            proj = project_strategy(persona_id, annual_return=annual_return,
                                    years=int(horizon_years), metric=metric)

        card = {
            "kind": "scenario",
            "title": title,
            "body": str(sc.get("body") or "").strip(),
            "cta": "Discuss this scenario",
            "grounded": True,
            "short_term": str(sc.get("short_term") or "").strip() or None,
            "long_term": str(sc.get("long_term") or "").strip() or None,
            "recommended_action": str(sc.get("recommended_action") or "").strip() or None,
            # Accurate impact derived from the deterministic projection. We show
            # the assumed investment return (not a CAGR of the balance, which
            # would be inflated by contribution inflows).
            "recommended_impact": (
                f"{_METRIC_LABELS[metric]} ≈ ${proj['final_value']:,.0f} in "
                f"{proj['years']} yrs (assumes {proj['annual_return']*100:.1f}%/yr return)"
            ),
            "follow_up_questions": [
                str(q).strip()
                for q in (sc.get("follow_up_questions") or [])
                if str(q).strip()
            ][:4]
            or None,
        }
        if declined:
            assumptions = [str(a).strip() for a in (sc.get("assumptions") or []) if str(a).strip()]
            card["assumptions"] = assumptions or None
        cards.append(card)

        series.append({"label": title, "points": proj["series"]})
        summary.append(
            {
                "scenario": title,
                "final_value": proj["final_value"],
                "total_contributions": proj["total_contributions"],
                # Report the assumed investment return per scenario (clear + honest),
                # not the contribution-inflated balance CAGR.
                "cagr": proj["annual_return"],
            }
        )

    if not cards:
        return parse_insight_cards(text, kind="scenario", grounded=True), None

    metric_label = str(obj.get("metric_label") or _METRIC_LABELS[metric]).strip()
    analysis = {
        "metric_label": metric_label,
        "unit": "CAD",
        "horizon_label": f"{int(horizon_years)}-year outlook",
        "series": series,
        "summary": summary,
        "chart_explanation": _chart_explanation(metric_label, horizon_years, summary),
        "recommended_scenario": str(obj.get("recommended_scenario") or "").strip() or None,
        "recommendation_rationale": str(obj.get("recommendation_rationale") or "").strip() or None,
        "comparison_summary": str(obj.get("comparison_summary") or "").strip() or None,
    }
    return cards, analysis


def _chart_explanation(metric_label: str, horizon_years, summary: list[dict]) -> str | None:
    """A grounded, plain-language walkthrough of the comparison chart.

    Deterministic (built from the same projection numbers the chart plots), so it
    never drifts from the lines on screen. Explains the axes, why the lines diverge,
    and quantifies the spread between the best- and worst-performing scenarios.
    """
    if len(summary) < 2:
        return None
    yrs = int(horizon_years)
    label = metric_label.lower()
    ranked = sorted(summary, key=lambda r: r["final_value"], reverse=True)
    best, worst = ranked[0], ranked[-1]
    diff = best["final_value"] - worst["final_value"]
    return (
        f"The chart projects your {label} year by year over the next {yrs} years — "
        f"one line per scenario. Each line starts from your current balance and "
        f"compounds your monthly contributions at that scenario's assumed annual "
        f"return, so steeper lines mean higher assumed returns. By year {yrs}, "
        f"“{best['scenario']}” reaches about ${best['final_value']:,.0f} "
        f"(at {best['cagr']*100:.1f}%/yr) while “{worst['scenario']}” reaches about "
        f"${worst['final_value']:,.0f} (at {worst['cagr']*100:.1f}%/yr) — a spread of "
        f"roughly ${diff:,.0f}. The lines sit close together in the early years and "
        f"fan out later, because a higher return compounds on an ever-larger balance."
    )


def _parse_agentic_object(text: str) -> dict | None:
    """Extract the agentic insights JSON object (first { … last })."""
    try:
        start = text.index("{")
        end = text.rindex("}") + 1
        obj = json.loads(text[start:end])
        if isinstance(obj, dict) and obj.get("scenarios"):
            return obj
    except (ValueError, json.JSONDecodeError):
        pass
    return None


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
