"""Provider-aware ADK model resolution (SPEC §10 / §5).

Google ADK is Gemini-native. When ``LLM_PROVIDER=openai`` we fall back to a
LiteLLM-wrapped model so the agentic demo still works end-to-end.

  * gemini  -> a model-id string; ADK routes through Vertex AI when
               ``GOOGLE_GENAI_USE_VERTEXAI=true`` and authenticates via ADC.
               When ``GCP_IMPERSONATE_SERVICE_ACCOUNT`` is set we return a
               ``Gemini`` subclass whose ``google.genai`` client is built with
               the SAME short-lived impersonated credentials the custom provider
               uses — so all three tabs (raw / skills / agentic) impersonate
               identically from one env var, with no ADC-level setup required.
  * openai  -> ``LiteLlm(model="openai/<model>")`` (SPEC §5 note).
"""
from __future__ import annotations

import os
from functools import cached_property


def _impersonated_gemini(model_id: str):
    """A ``Gemini`` model whose Vertex client uses impersonated credentials.

    ADK builds its own ``google.genai`` client from ADC and ignores our provider
    layer, so — per ADK's documented extension point — we subclass ``Gemini`` and
    override ``api_client`` to inject the impersonated credentials.
    """
    from google.adk.models import Gemini
    from google.genai import Client

    from ..config import get_settings
    from ..llm_provider import build_gcp_credentials

    class _ImpersonatedGemini(Gemini):
        @cached_property
        def api_client(self) -> Client:  # noqa: D401 — ADK override point
            s = get_settings()
            return Client(
                vertexai=s.use_vertexai,
                project=s.google_cloud_project,
                location=s.google_cloud_location,
                credentials=build_gcp_credentials(),
            )

    return _ImpersonatedGemini(model=model_id)


def adk_generate_content_config():
    """generate_content config for ADK agents — carries the AFC remote-call cap
    (``GOOGLE_AFC_MAX_REMOTE_CALLS``) so the agentic path matches the custom
    provider. Returns None for non-Gemini providers (LiteLLM ignores it)."""
    if os.getenv("LLM_PROVIDER", "gemini").lower() != "gemini":
        return None
    from google.genai import types

    from ..llm_provider import automatic_function_calling_config

    return types.GenerateContentConfig(
        automatic_function_calling=automatic_function_calling_config()
    )


def resolve_adk_model():
    provider = os.getenv("LLM_PROVIDER", "gemini").lower()
    if provider == "gemini":
        model_id = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")
        if os.getenv("GCP_IMPERSONATE_SERVICE_ACCOUNT"):
            return _impersonated_gemini(model_id)
        # Plain ADC — a bare model-id string lets ADK build its own client.
        return model_id
    if provider == "openai":
        from google.adk.models.lite_llm import LiteLlm

        return LiteLlm(model=f"openai/{os.getenv('OPENAI_MODEL', 'gpt-4o')}")
    raise ValueError(f"Unknown LLM_PROVIDER: {provider}")
