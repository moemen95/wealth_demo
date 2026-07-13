"""GET /insights/{persona_id}?arch=raw|skills|agentic — proactive insights."""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException, Query

from ..data_loader import VALID_PERSONAS
from ..llm_provider import current_provider_name
from ..models.schemas import Architecture, InsightsResponse, Insight
from ._common import Timer, run_insights, to_tool_calls

log = logging.getLogger("wealth.insights")
router = APIRouter()


@router.get("/insights/{persona_id}", response_model=InsightsResponse)
async def insights(
    persona_id: str,
    arch: Architecture = Query("agentic"),
) -> InsightsResponse:
    if persona_id not in VALID_PERSONAS:
        raise HTTPException(status_code=404, detail=f"Unknown persona '{persona_id}'")

    provider = current_provider_name()
    session_id = f"insights-{persona_id}-{uuid.uuid4().hex[:8]}"

    with Timer() as t:
        try:
            cards, executed = await run_insights(arch, persona_id, session_id)
            error = None
        except Exception as exc:  # noqa: BLE001
            log.exception("insights failed")
            cards = [
                {
                    "kind": "basic",
                    "title": "Insights unavailable",
                    "body": (
                        f"The {arch} architecture could not generate insights on "
                        f"provider '{provider}'. Details: {exc}"
                    ),
                    "cta": "Try the chat",
                }
            ]
            executed = []
            error = str(exc)

    return InsightsResponse(
        architecture=arch,
        provider=provider,
        persona_id=persona_id,
        insights=[Insight(**c) for c in cards],
        tool_calls=to_tool_calls(executed),
        timing_ms=t.elapsed_ms,
        error=error,
    )
