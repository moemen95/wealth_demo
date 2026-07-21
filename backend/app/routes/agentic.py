"""Agentic-only endpoints: interactive discovery, context memory, and clearing.

These power the Agentic approach's "ask before advising" flow. Discovery asks the
context subagent for a clarifying question + scenario options; /context persists the
client's answer to session memory; /clear wipes it. Raw and Skills do not use these.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..architectures import agentic_adk
from ..data_loader import VALID_PERSONAS
from ._common import Timer, to_tool_calls
from ..models.schemas import ToolCall

log = logging.getLogger("wealth.agentic")
router = APIRouter()


class DiscoveryRequest(BaseModel):
    persona_id: str
    session_id: str


class DiscoveryResponse(BaseModel):
    needs_context: bool
    question: str = ""
    options: list[str] = []
    stored_context: str | None = None
    tool_calls: list[ToolCall] = []
    timing_ms: int = 0
    error: str | None = None


class ContextRequest(BaseModel):
    persona_id: str
    session_id: str
    answer: str = ""
    declined: bool = False


class ContextResponse(BaseModel):
    follow_up: str = ""
    stored_context: str = ""
    declined: bool = False
    tool_calls: list[ToolCall] = []
    timing_ms: int = 0
    error: str | None = None


class ClearRequest(BaseModel):
    persona_id: str
    session_id: str


class MemoryEntry(BaseModel):
    context: str
    declined: bool = False


class MemoryResponse(BaseModel):
    client_context: str = ""
    declined: bool = False
    entries: list[MemoryEntry] = []


class MemoryRequest(BaseModel):
    persona_id: str
    session_id: str


def _check(persona_id: str) -> None:
    if persona_id not in VALID_PERSONAS:
        raise HTTPException(status_code=404, detail=f"Unknown persona '{persona_id}'")


@router.post("/agentic/discovery", response_model=DiscoveryResponse)
async def discovery(req: DiscoveryRequest) -> DiscoveryResponse:
    _check(req.persona_id)
    data: dict = {}
    executed: list = []
    error: str | None = None
    with Timer() as t:
        try:
            data, executed = await agentic_adk.agentic_discovery(
                req.persona_id, req.session_id
            )
        except Exception as exc:  # noqa: BLE001 — keep the demo alive
            log.exception("discovery failed")
            error = str(exc)
    if error is not None:
        return DiscoveryResponse(
            needs_context=True,
            question="What's your main financial goal right now?",
            options=["Retire early", "Buy a home", "Fund education", "Grow wealth"],
            timing_ms=t.elapsed_ms,
            error=error,
        )
    return DiscoveryResponse(
        **data, tool_calls=to_tool_calls(executed), timing_ms=t.elapsed_ms
    )


@router.post("/agentic/context", response_model=ContextResponse)
async def context(req: ContextRequest) -> ContextResponse:
    _check(req.persona_id)
    data: dict = {}
    executed: list = []
    error: str | None = None
    with Timer() as t:
        try:
            data, executed = await agentic_adk.agentic_save_context(
                req.persona_id, req.session_id, req.answer, req.declined
            )
        except Exception as exc:  # noqa: BLE001
            log.exception("save context failed")
            error = str(exc)
    if error is not None:
        return ContextResponse(
            stored_context=req.answer,
            declined=req.declined,
            timing_ms=t.elapsed_ms,
            error=error,
        )
    return ContextResponse(
        **data, tool_calls=to_tool_calls(executed), timing_ms=t.elapsed_ms
    )


@router.post("/agentic/clear")
async def clear(req: ClearRequest) -> dict:
    _check(req.persona_id)
    await agentic_adk.agentic_clear_memory(req.persona_id, req.session_id)
    return {"ok": True}


@router.post("/agentic/memory", response_model=MemoryResponse)
async def memory(req: MemoryRequest) -> MemoryResponse:
    """Read-only view of the collected context that tailors this session's insights."""
    _check(req.persona_id)
    data = await agentic_adk.read_session_memory(req.persona_id, req.session_id)
    return MemoryResponse(**data)
