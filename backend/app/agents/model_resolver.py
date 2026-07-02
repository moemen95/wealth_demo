"""Provider-aware ADK model resolution (SPEC §10 / §5).

Google ADK is Gemini-native. When ``LLM_PROVIDER=openai`` we fall back to a
LiteLLM-wrapped model so the agentic demo still works end-to-end.

  * gemini  -> a model-id string; ADK routes through Vertex AI when
               ``GOOGLE_GENAI_USE_VERTEXAI=true``. Credentials come from ADC —
               which can itself be impersonated at the gcloud level via
               ``gcloud config set auth/impersonate_service_account <SA>`` (the
               programmatic impersonation path is demonstrated in
               ``llm_provider.py``).
  * openai  -> ``LiteLlm(model="openai/<model>")`` (SPEC §5 note).
"""
from __future__ import annotations

import os


def resolve_adk_model():
    provider = os.getenv("LLM_PROVIDER", "gemini").lower()
    if provider == "gemini":
        return os.getenv("GEMINI_MODEL", "gemini-1.5-pro")
    if provider == "openai":
        from google.adk.models.lite_llm import LiteLlm

        return LiteLlm(model=f"openai/{os.getenv('OPENAI_MODEL', 'gpt-4o')}")
    raise ValueError(f"Unknown LLM_PROVIDER: {provider}")
