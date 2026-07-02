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


def test_json_schema_to_gemini_uppercases_types():
    schema = _json_schema_to_gemini(
        {"type": "object", "properties": {"x": {"type": "string"}}, "required": ["x"]}
    )
    assert str(schema.type).upper().endswith("OBJECT")


def test_all_skill_schemas_convert_to_gemini_tools():
    tools = GeminiVertexProvider._to_gemini_tools(SKILL_SCHEMAS)
    assert len(tools[0].function_declarations) == len(SKILL_SCHEMAS)
