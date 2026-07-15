"""Central configuration.

Exposes typed settings read straight from the process environment. Environment
variables are loaded by ``make`` (which sources backend/.env before running the
app) — the application no longer loads a .env file itself. Only a handful of
values are truly required and they depend on the selected provider, so we keep
everything optional here and validate lazily inside the provider layer.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def require_env_file(path: Path | None = None) -> None:
    """Raise if the backend environment file is absent.

    The app no longer loads .env itself — ``make`` sources it before launch — but
    a missing file almost always means it was never created, so we fail fast with
    a clear message instead of booting with silently-empty credentials.
    """
    p = path or _ENV_PATH
    if not p.exists():
        raise RuntimeError(
            f"Missing environment file: {p}\n"
            "Copy backend/.env.example to backend/.env (or run `make env`), then "
            "start the backend with `make backend` / `make dev` so the variables "
            "are loaded into the environment."
        )


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

    @property
    def google_afc_max_remote_calls(self) -> int:
        """Cap on automatic-function-calling remote calls per generate_content
        request. Applied to the generate-content config on both Gemini paths."""
        try:
            return int(os.getenv("GOOGLE_AFC_MAX_REMOTE_CALLS", "50"))
        except ValueError:
            return 50

    # ---- Server ----
    @property
    def cors_origins(self) -> list[str]:
        raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
        return [o.strip() for o in raw.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
