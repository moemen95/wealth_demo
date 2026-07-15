"""Provider abstraction tests — SPEC test case 5 (env-only swap) + schema norm."""
import app.llm_provider as llm
from app.llm_provider import GeminiVertexProvider, _json_schema_to_gemini
from app.skills import SKILL_SCHEMAS


def _clear_cache():
    llm._CACHE.clear()


def test_provider_selected_by_env_openai(monkeypatch):
    _clear_cache()
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-dummy")
    prov = llm.get_provider()
    assert prov.name == "openai"
    assert llm.current_provider_name() == "openai"


def test_provider_selected_by_env_gemini(monkeypatch):
    _clear_cache()
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "fake-project")

    # Stub out real GCP auth + genai client so no network/credentials needed.
    import google.auth

    monkeypatch.setattr(google.auth, "default", lambda scopes=None: (object(), None))
    from google import genai

    monkeypatch.setattr(genai, "Client", lambda **kw: object())

    prov = llm.get_provider()
    assert prov.name == "gemini"
    _clear_cache()


def test_unknown_provider_raises(monkeypatch):
    _clear_cache()
    monkeypatch.setenv("LLM_PROVIDER", "banana")
    import pytest

    with pytest.raises(ValueError):
        llm.get_provider()
    _clear_cache()


def test_build_gcp_credentials_plain_adc(monkeypatch):
    """No impersonation env → return the ambient ADC unchanged."""
    monkeypatch.delenv("GCP_IMPERSONATE_SERVICE_ACCOUNT", raising=False)
    import google.auth

    src = object()
    monkeypatch.setattr(google.auth, "default", lambda scopes=None: (src, None))
    assert llm.build_gcp_credentials() is src


def test_build_gcp_credentials_impersonates(monkeypatch):
    """With the env var set → wrap ADC in short-lived impersonated credentials."""
    monkeypatch.setenv(
        "GCP_IMPERSONATE_SERVICE_ACCOUNT", "sa@proj.iam.gserviceaccount.com"
    )
    import google.auth
    from google.auth import impersonated_credentials

    src = object()
    monkeypatch.setattr(google.auth, "default", lambda scopes=None: (src, None))
    captured = {}

    class _FakeImpersonated:
        def __init__(self, **kw):
            captured.update(kw)

    monkeypatch.setattr(impersonated_credentials, "Credentials", _FakeImpersonated)

    creds = llm.build_gcp_credentials()
    assert isinstance(creds, _FakeImpersonated)
    assert captured["source_credentials"] is src
    assert captured["target_principal"] == "sa@proj.iam.gserviceaccount.com"
    assert captured["lifetime"] == 3600


def test_json_schema_to_gemini_uppercases_types():
    schema = _json_schema_to_gemini(
        {"type": "object", "properties": {"x": {"type": "string"}}, "required": ["x"]}
    )
    assert str(schema.type).upper().endswith("OBJECT")


def test_all_skill_schemas_convert_to_gemini_tools():
    tools = GeminiVertexProvider._to_gemini_tools(SKILL_SCHEMAS)
    assert len(tools[0].function_declarations) == len(SKILL_SCHEMAS)
