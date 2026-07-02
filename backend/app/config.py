"""Central configuration.

Reads a backend/.env file (if present) and exposes typed settings. Only a
handful of values are truly required and they depend on the selected provider,
so we keep everything optional here and validate lazily inside the provider
layer — this lets the server boot even with a partial .env so the UI and the
non-LLM endpoints stay reachable during a demo.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env as early as possible.
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)


class Settings:
    @property
    def llm_provider(self) -> str:
        return os.getenv("LLM_PROVIDER", "gemini").lower()

    # ---- OpenAI ----
    @property
    def openai_api_key(self) -> str | None:
        return os.getenv("OPENAI_API_KEY")

    @property
    def openai_model(self) -> str:
        return os.getenv("OPENAI_MODEL", "gpt-4o")

    @property
    def openai_base_url(self) -> str | None:
        return os.getenv("OPENAI_BASE_URL") or None

    # ---- Gemini / Vertex ----
    @property
    def google_cloud_project(self) -> str | None:
        return os.getenv("GOOGLE_CLOUD_PROJECT")

    @property
    def google_cloud_location(self) -> str:
        return os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")

    @property
    def gemini_model(self) -> str:
        return os.getenv("GEMINI_MODEL", "gemini-1.5-pro")

    @property
    def impersonate_service_account(self) -> str | None:
        return os.getenv("GCP_IMPERSONATE_SERVICE_ACCOUNT")

    @property
    def use_vertexai(self) -> bool:
        return os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "true").lower() == "true"

    # ---- Server ----
    @property
    def cors_origins(self) -> list[str]:
        raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
        return [o.strip() for o in raw.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
