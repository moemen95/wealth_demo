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


def test_require_env_file_passes_when_present(tmp_path):
    from app.config import require_env_file

    p = tmp_path / ".env"
    p.write_text("X=1\n")
    require_env_file(p)  # must not raise


def test_require_env_file_raises_when_missing(tmp_path):
    import pytest

    from app.config import require_env_file

    with pytest.raises(RuntimeError, match="Missing environment file"):
        require_env_file(tmp_path / "nope.env")


def test_afc_max_remote_calls_default_override_and_invalid(monkeypatch):
    from app.config import get_settings

    monkeypatch.delenv("GOOGLE_AFC_MAX_REMOTE_CALLS", raising=False)
    assert get_settings().google_afc_max_remote_calls == 50
    monkeypatch.setenv("GOOGLE_AFC_MAX_REMOTE_CALLS", "12")
    assert get_settings().google_afc_max_remote_calls == 12
    monkeypatch.setenv("GOOGLE_AFC_MAX_REMOTE_CALLS", "not-an-int")
    assert get_settings().google_afc_max_remote_calls == 50  # falls back


def test_automatic_function_calling_config_uses_setting(monkeypatch):
    monkeypatch.setenv("GOOGLE_AFC_MAX_REMOTE_CALLS", "33")
    afc = llm.automatic_function_calling_config()
    assert afc.maximum_remote_calls == 33


def test_json_schema_to_gemini_uppercases_types():
    schema = _json_schema_to_gemini(
        {"type": "object", "properties": {"x": {"type": "string"}}, "required": ["x"]}
    )
    assert str(schema.type).upper().endswith("OBJECT")


def test_all_skill_schemas_convert_to_gemini_tools():
    tools = GeminiVertexProvider._to_gemini_tools(SKILL_SCHEMAS)
    assert len(tools[0].function_declarations) == len(SKILL_SCHEMAS)


def test_parallel_function_calls_reply_in_a_single_turn():
    """Gemini 400s unless a function-call turn is answered with the same number of
    function_response parts in ONE turn. When the model makes 2 parallel calls, we
    must reply with a single turn carrying both responses (not one turn each)."""
    from types import SimpleNamespace

    # Fake genai response: round 0 = two parallel function calls; round 1 = text.
    def fc_part(name):
        return SimpleNamespace(
            function_call=SimpleNamespace(name=name, args={"persona_id": "affluent"}),
            text=None,
        )

    round0 = SimpleNamespace(
        candidates=[SimpleNamespace(content=SimpleNamespace(
            role="model", parts=[fc_part("get_portfolio_total"), fc_part("get_allocation")]
        ))],
        text="",
    )
    round1 = SimpleNamespace(
        candidates=[SimpleNamespace(content=SimpleNamespace(role="model", parts=[]))],
        text="Here is your summary.",
    )

    captured_contents = []

    class _FakeModels:
        def __init__(self):
            self._responses = [round0, round1]

        def generate_content(self, model, contents, config):
            captured_contents.append(list(contents))  # snapshot per round
            return self._responses.pop(0)

    prov = GeminiVertexProvider.__new__(GeminiVertexProvider)  # skip credentialed __init__
    prov.client = SimpleNamespace(models=_FakeModels())
    prov.model = "gemini-x"

    result = prov.run_with_tools(
        [{"role": "user", "content": "summarize my portfolio"}],
        SKILL_SCHEMAS,
        executor=lambda name, args: {"tool": name},
        max_rounds=1,
    )

    assert result.text == "Here is your summary."
    assert [c.name for c in result.tool_calls] == ["get_portfolio_total", "get_allocation"]
    # The round-1 request must end with ONE user turn holding BOTH function responses.
    round1_contents = captured_contents[1]
    resp_turn = round1_contents[-1]
    assert resp_turn.role == "user"
    assert len(resp_turn.parts) == 2  # matches the 2 function_call parts


def test_no_arg_tool_omits_parameters_not_empty_object():
    """Vertex 400s on a FunctionDeclaration with an empty-properties OBJECT, so a
    no-arg tool (get_market_snapshot) must have parameters=None, and NO tool may
    convert to an empty-properties OBJECT."""
    fds = GeminiVertexProvider._to_gemini_tools(SKILL_SCHEMAS)[0].function_declarations
    by_name = {fd.name: fd for fd in fds}
    assert by_name["get_market_snapshot"].parameters is None
    for fd in fds:
        p = fd.parameters
        if p is not None and str(getattr(p, "type", "")).upper().endswith("OBJECT"):
            assert p.properties, f"{fd.name} has an empty-properties OBJECT (Vertex 400)"
