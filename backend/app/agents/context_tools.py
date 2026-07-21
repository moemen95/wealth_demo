"""Tools for the context subagent — persist the client's goals to session memory.

ADK auto-injects ``tool_context`` (a ``ToolContext``) and hides it from the model's
tool schema. Writing to ``tool_context.state`` records a state delta that ADK commits
to the session on the next event, so the collected context survives across turns and
is available to the whole agent tree (via ``{client_context}`` instruction
placeholders) and to the insights generator (which reads it back off the session).
"""
from __future__ import annotations

from google.adk.tools import ToolContext


def save_client_context(
    context: str, declined: bool = False, tool_context: ToolContext = None
) -> dict:
    """Save the client's stated goal / life plan to memory for this session.

    Call this whenever the client shares (or declines to share) what they're
    planning — e.g. retiring early, buying a home, funding education. Pass a short
    normalized summary as ``context`` that MERGES the new answer with everything
    already known this session — never drop previously shared facts.

    ``declined`` means the client gave NO usable information at all (they hit Skip
    or said something like "I'm not sure"). A negative preference, a concern, a
    constraint, or a "no" to a specific option (e.g. "I don't want risk", "no
    children", "not planning to move") is still real context — keep
    ``declined=False`` and record it. When in doubt, ``declined=False``.
    """
    if tool_context is not None:
        tool_context.state["client_context"] = context or ""
        tool_context.state["client_context_declined"] = bool(declined)
        # Also keep an append-only log of everything saved this session so the UI
        # can show the full history of answers that shaped the insights. Reassign
        # (don't mutate in place) so ADK records the state delta.
        log = list(tool_context.state.get("context_log", []))
        log.append({"context": context or "", "declined": bool(declined)})
        tool_context.state["context_log"] = log
    return {"saved": True, "context": context or "", "declined": bool(declined)}
