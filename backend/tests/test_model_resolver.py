"""ADK model resolution + Gemini impersonation parity (SPEC §10 / §5).

The agentic tab runs on Google ADK, which builds its own ``google.genai`` client
and ignores our custom provider layer. These tests lock in that a single env var
(``GCP_IMPERSONATE_SERVICE_ACCOUNT``) drives impersonation for the ADK path too —
without any live GCP credentials.
"""
import pytest

import app.agents.model_resolver as mr


def test_resolve_gemini_plain_returns_model_id(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-1.5-pro")
    monkeypatch.delenv("GCP_IMPERSONATE_SERVICE_ACCOUNT", raising=False)
    # Plain ADC → a bare model-id string (ADK builds its own client).
    assert mr.resolve_adk_model() == "gemini-1.5-pro"


def test_resolve_gemini_impersonated_returns_lazy_subclass(monkeypatch):
    from google.adk.models import Gemini

    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-1.5-pro")
    monkeypatch.setenv(
        "GCP_IMPERSONATE_SERVICE_ACCOUNT", "sa@proj.iam.gserviceaccount.com"
    )
    model = mr.resolve_adk_model()
    assert isinstance(model, Gemini)
    assert model.model == "gemini-1.5-pro"
    # Credentials must be built lazily — constructing the model must not need ADC.
    assert "api_client" not in model.__dict__


def test_impersonated_gemini_client_uses_impersonated_creds(monkeypatch):
    """The crux: accessing the ADK model's client injects OUR impersonated creds
    and the configured project/location into google.genai.Client."""
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-1.5-pro")
    monkeypatch.setenv(
        "GCP_IMPERSONATE_SERVICE_ACCOUNT", "sa@proj.iam.gserviceaccount.com"
    )
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "fake-project")
    monkeypatch.setenv("GOOGLE_CLOUD_LOCATION", "europe-west1")
    monkeypatch.setenv("GOOGLE_GENAI_USE_VERTEXAI", "true")

    import app.llm_provider as llm

    sentinel_creds = object()
    monkeypatch.setattr(llm, "build_gcp_credentials", lambda: sentinel_creds)

    from google import genai

    captured = {}
    monkeypatch.setattr(genai, "Client", lambda **kw: captured.update(kw) or object())

    model = mr.resolve_adk_model()
    _ = model.api_client  # triggers lazy client construction

    assert captured["credentials"] is sentinel_creds
    assert captured["project"] == "fake-project"
    assert captured["location"] == "europe-west1"
    assert captured["vertexai"] is True


def test_resolve_openai_returns_litellm(monkeypatch):
    from google.adk.models.lite_llm import LiteLlm

    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-4o")
    assert isinstance(mr.resolve_adk_model(), LiteLlm)


def test_resolve_unknown_provider_raises(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "banana")
    with pytest.raises(ValueError):
        mr.resolve_adk_model()


def test_adk_generate_content_config_carries_afc_cap(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GOOGLE_AFC_MAX_REMOTE_CALLS", "42")
    cfg = mr.adk_generate_content_config()
    assert cfg is not None
    assert cfg.automatic_function_calling.maximum_remote_calls == 42


def test_adk_generate_content_config_none_for_openai(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    assert mr.adk_generate_content_config() is None
