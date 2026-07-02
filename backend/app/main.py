"""FastAPI entrypoint for the Wealth Insights Demo backend."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .llm_provider import current_provider_name, provider_label
from .routes import chat, insights, personas, provider

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Wealth Insights Demo API",
    version="0.1.0",
    description=(
        "Three architectures (raw / skills / agentic) over a provider "
        "abstraction (OpenAI or Gemini on Vertex AI)."
    ),
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(personas.router, tags=["personas"])
app.include_router(insights.router, tags=["insights"])
app.include_router(chat.router, tags=["chat"])
app.include_router(provider.router, tags=["provider"])


@app.get("/health")
async def health() -> dict:
    name = current_provider_name()
    return {"status": "ok", "provider": name, "provider_label": provider_label(name)}
