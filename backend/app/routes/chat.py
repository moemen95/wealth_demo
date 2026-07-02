"""POST /chat — follow-up conversation across the three architectures."""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter

from ..llm_provider import current_provider_name
from ..models.schemas import ChatRequest, ChatResponse
from ._common import Timer, run_answer, to_tool_calls

log = logging.getLogger("wealth.chat")
router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    session_id = req.session_id or f"sess-{uuid.uuid4().hex[:12]}"
    provider = current_provider_name()

    with Timer() as t:
        try:
            reply, executed = await run_answer(
                req.architecture, req.persona_id, session_id, req.message
            )
            error = None
        except Exception as exc:  # noqa: BLE001 — surface, don't crash the demo
            log.exception("chat failed")
            reply = (
                f"⚠️ The {req.architecture} architecture could not complete this "
                f"request on provider '{provider}'. Details: {exc}"
            )
            executed = []
            error = str(exc)

    return ChatResponse(
        reply=reply,
        provider=provider,
        architecture=req.architecture,
        session_id=session_id,
        tool_calls=to_tool_calls(executed),
        timing_ms=t.elapsed_ms,
        error=error,
    )
