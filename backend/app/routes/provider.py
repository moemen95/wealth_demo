"""GET/POST /provider — expose the active LLM provider and allow a live toggle.

The live toggle powers SPEC §14 "Beat 4 — provider swap live on stage" without
a process restart. It flips the ``LLM_PROVIDER`` env var in-process; the
provider factory re-reads it on every call.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..llm_provider import current_provider_name, provider_label

router = APIRouter()


class ProviderInfo(BaseModel):
    provider: str
    label: str


class ProviderSwitch(BaseModel):
    provider: str  # "openai" | "gemini"


@router.get("/provider", response_model=ProviderInfo)
async def get_provider_info() -> ProviderInfo:
    name = current_provider_name()
    return ProviderInfo(provider=name, label=provider_label(name))


@router.post("/provider", response_model=ProviderInfo)
async def set_provider(body: ProviderSwitch) -> ProviderInfo:
    name = body.provider.lower()
    if name not in ("openai", "gemini"):
        raise HTTPException(status_code=400, detail="provider must be 'openai' or 'gemini'")
    os.environ["LLM_PROVIDER"] = name
    return ProviderInfo(provider=name, label=provider_label(name))
