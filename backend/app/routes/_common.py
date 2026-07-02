"""Shared helpers for the route handlers — dispatch, timing, error shaping."""
from __future__ import annotations

import time
from typing import Awaitable, Callable

from fastapi.concurrency import run_in_threadpool

from ..architectures import agentic_adk, raw_prompt, skills as skills_arch
from ..llm_provider import ExecutedToolCall
from ..models.schemas import ToolCall


def to_tool_calls(executed: list[ExecutedToolCall]) -> list[ToolCall]:
    return [
        ToolCall(name=e.name, arguments=e.arguments or {}, result=e.result)
        for e in executed
    ]


class Timer:
    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, *exc):
        self.elapsed_ms = int((time.perf_counter() - self._start) * 1000)


async def run_answer(
    architecture: str, persona_id: str, session_id: str, message: str
) -> tuple[str, list[ExecutedToolCall]]:
    if architecture == "raw":
        return await run_in_threadpool(raw_prompt.raw_answer, persona_id, message)
    if architecture == "skills":
        return await run_in_threadpool(skills_arch.skills_answer, persona_id, message)
    if architecture == "agentic":
        return await agentic_adk.agentic_answer(persona_id, session_id, message)
    raise ValueError(f"Unknown architecture: {architecture}")


async def run_insights(
    architecture: str, persona_id: str, session_id: str
) -> tuple[list[dict], list[ExecutedToolCall]]:
    if architecture == "raw":
        return await run_in_threadpool(raw_prompt.raw_insights, persona_id)
    if architecture == "skills":
        return await run_in_threadpool(skills_arch.skills_insights, persona_id)
    if architecture == "agentic":
        return await agentic_adk.agentic_insights(persona_id, session_id)
    raise ValueError(f"Unknown architecture: {architecture}")
