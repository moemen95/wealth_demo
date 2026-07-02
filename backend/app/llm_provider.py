"""Provider abstraction layer (SPEC §5).

Every architecture (raw / skills / agentic) consumes THIS module rather than
importing OpenAI / google-genai directly. The layer normalises three things so
the rest of the app never branches on the vendor:

  * messages   -> a plain ``[{"role", "content"}]`` list
  * tools      -> OpenAI-style function schemas (converted to Gemini's
                  ``function_declarations`` internally)
  * responses  -> :class:`LLMResult` with ``.text`` and executed ``.tool_calls``

Provider is chosen at runtime by ``LLM_PROVIDER`` (openai | gemini). Switching
providers requires **no code changes** — only an env change (SPEC test case 5).

Gemini runs on Vertex AI and mints **short-lived** credentials via GCP service
account impersonation when ``GCP_IMPERSONATE_SERVICE_ACCOUNT`` is set — no
long-lived JSON keys touch disk.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Callable, Optional, Protocol

from .config import get_settings

# A tool executor takes (tool_name, arguments) and returns a JSON-serialisable result.
ToolExecutor = Callable[[str, dict], Any]

MAX_TOOL_ROUNDS_DEFAULT = 1  # Skills = single-shot: one tool round, then finalise.


@dataclass
class ExecutedToolCall:
    name: str
    arguments: dict = field(default_factory=dict)
    result: Any = None


@dataclass
class LLMResult:
    text: str
    tool_calls: list[ExecutedToolCall] = field(default_factory=list)


class LLMProvider(Protocol):
    name: str
    label: str
    model: str

    def complete(self, messages: list[dict]) -> str: ...

    def run_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        executor: ToolExecutor,
        max_rounds: int = MAX_TOOL_ROUNDS_DEFAULT,
    ) -> LLMResult: ...


# ─────────────────────────────────────────────────────────────
# OpenAI
# ─────────────────────────────────────────────────────────────
class OpenAIProvider:
    name = "openai"
    label = "OpenAI"

    def __init__(self) -> None:
        from openai import OpenAI

        s = get_settings()
        if not s.openai_api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is required when LLM_PROVIDER=openai. "
                "Set it in backend/.env."
            )
        self.client = OpenAI(api_key=s.openai_api_key, base_url=s.openai_base_url)
        self.model = s.openai_model

    def complete(self, messages: list[dict]) -> str:
        resp = self.client.chat.completions.create(
            model=self.model, messages=messages
        )
        return resp.choices[0].message.content or ""

    def run_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        executor: ToolExecutor,
        max_rounds: int = MAX_TOOL_ROUNDS_DEFAULT,
    ) -> LLMResult:
        convo = list(messages)
        executed: list[ExecutedToolCall] = []

        for round_idx in range(max_rounds + 1):
            allow_tools = round_idx < max_rounds
            # On the finalize round omit tools entirely (passing tool_choice
            # without tools can 400 on some endpoints).
            kwargs: dict = {"model": self.model, "messages": convo}
            if allow_tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"
            resp = self.client.chat.completions.create(**kwargs)
            msg = resp.choices[0].message

            if allow_tools and msg.tool_calls:
                convo.append(
                    {
                        "role": "assistant",
                        "content": msg.content or "",
                        "tool_calls": [
                            {
                                "id": tc.id,
                                "type": "function",
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": tc.function.arguments,
                                },
                            }
                            for tc in msg.tool_calls
                        ],
                    }
                )
                for tc in msg.tool_calls:
                    try:
                        args = json.loads(tc.function.arguments or "{}")
                    except json.JSONDecodeError:
                        args = {}
                    result = executor(tc.function.name, args)
                    executed.append(
                        ExecutedToolCall(tc.function.name, args, result)
                    )
                    convo.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": json.dumps(result, default=str),
                        }
                    )
                continue

            return LLMResult(text=msg.content or "", tool_calls=executed)

        return LLMResult(text="", tool_calls=executed)


# ─────────────────────────────────────────────────────────────
# Gemini on Vertex AI (Agent Platform) via SA impersonation
# ─────────────────────────────────────────────────────────────
class GeminiVertexProvider:
    name = "gemini"
    label = "Gemini / Vertex"

    def __init__(self) -> None:
        from google import genai

        s = get_settings()
        if not s.google_cloud_project:
            raise RuntimeError(
                "GOOGLE_CLOUD_PROJECT is required when LLM_PROVIDER=gemini. "
                "Set it in backend/.env."
            )
        credentials = self._build_credentials()
        self.client = genai.Client(
            vertexai=True,
            project=s.google_cloud_project,
            location=s.google_cloud_location,
            credentials=credentials,
        )
        self.model = s.gemini_model

    @staticmethod
    def _build_credentials():
        """Short-lived creds via impersonation, else plain ADC (SPEC §5)."""
        import google.auth
        from google.auth import impersonated_credentials

        scopes = ["https://www.googleapis.com/auth/cloud-platform"]
        source_credentials, _ = google.auth.default(scopes=scopes)

        target_sa = get_settings().impersonate_service_account
        if not target_sa:
            return source_credentials  # plain ADC — no impersonation

        return impersonated_credentials.Credentials(
            source_credentials=source_credentials,
            target_principal=target_sa,
            target_scopes=scopes,
            lifetime=3600,  # 1h short-lived tokens; clean audit trail
        )

    # -- message / schema normalisation --
    @staticmethod
    def _split_messages(messages: list[dict]):
        from google.genai import types

        system_parts: list[str] = []
        contents = []
        for m in messages:
            role, content = m.get("role"), m.get("content", "")
            if role == "system":
                if content:
                    system_parts.append(content)
                continue
            gemini_role = "model" if role == "assistant" else "user"
            contents.append(
                types.Content(role=gemini_role, parts=[types.Part.from_text(text=content)])
            )
        system_instruction = "\n\n".join(system_parts) or None
        return system_instruction, contents

    @staticmethod
    def _to_gemini_tools(tools: list[dict]):
        """OpenAI function schemas -> Gemini function_declarations."""
        from google.genai import types

        declarations = []
        for t in tools:
            fn = t.get("function", t)
            declarations.append(
                types.FunctionDeclaration(
                    name=fn["name"],
                    description=fn.get("description", ""),
                    parameters=_json_schema_to_gemini(fn.get("parameters", {})),
                )
            )
        return [types.Tool(function_declarations=declarations)]

    def complete(self, messages: list[dict]) -> str:
        from google.genai import types

        system_instruction, contents = self._split_messages(messages)
        resp = self.client.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(system_instruction=system_instruction),
        )
        return resp.text or ""

    def run_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        executor: ToolExecutor,
        max_rounds: int = MAX_TOOL_ROUNDS_DEFAULT,
    ) -> LLMResult:
        from google.genai import types

        system_instruction, contents = self._split_messages(messages)
        gemini_tools = self._to_gemini_tools(tools)
        executed: list[ExecutedToolCall] = []

        for round_idx in range(max_rounds + 1):
            allow_tools = round_idx < max_rounds
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=gemini_tools if allow_tools else None,
            )
            resp = self.client.models.generate_content(
                model=self.model, contents=contents, config=config
            )

            candidate = resp.candidates[0] if resp.candidates else None
            fn_calls = []
            if candidate and candidate.content and candidate.content.parts:
                fn_calls = [
                    p.function_call
                    for p in candidate.content.parts
                    if getattr(p, "function_call", None)
                ]

            if allow_tools and fn_calls:
                contents.append(candidate.content)  # model turn w/ function_call(s)
                for fc in fn_calls:
                    args = dict(fc.args) if fc.args else {}
                    result = executor(fc.name, args)
                    executed.append(ExecutedToolCall(fc.name, args, result))
                    contents.append(
                        types.Content(
                            role="user",
                            parts=[
                                types.Part.from_function_response(
                                    name=fc.name, response={"result": result}
                                )
                            ],
                        )
                    )
                continue

            return LLMResult(text=resp.text or "", tool_calls=executed)

        return LLMResult(text="", tool_calls=executed)


def _json_schema_to_gemini(schema: dict):
    """Recursively convert a JSON Schema dict into a google-genai ``Schema``.

    The main friction is that Gemini's ``Type`` enum is upper-cased
    (``OBJECT``/``STRING``) whereas JSON Schema uses lower-case.
    """
    from google.genai import types

    if not schema:
        return None

    kwargs: dict[str, Any] = {}
    json_type = schema.get("type")
    if isinstance(json_type, str):
        kwargs["type"] = json_type.upper()
    if "description" in schema:
        kwargs["description"] = schema["description"]
    if "enum" in schema:
        kwargs["enum"] = schema["enum"]
    if "properties" in schema:
        kwargs["properties"] = {
            k: _json_schema_to_gemini(v) for k, v in schema["properties"].items()
        }
    if "required" in schema:
        kwargs["required"] = schema["required"]
    if "items" in schema:
        kwargs["items"] = _json_schema_to_gemini(schema["items"])
    return types.Schema(**kwargs)


# ─────────────────────────────────────────────────────────────
# Factory
# ─────────────────────────────────────────────────────────────
_CACHE: dict[str, LLMProvider] = {}


def get_provider() -> LLMProvider:
    """Return the provider selected by ``LLM_PROVIDER`` (re-read every call so a
    live toggle takes effect without a process restart)."""
    provider = os.getenv("LLM_PROVIDER", "gemini").lower()
    if provider in _CACHE:
        return _CACHE[provider]

    if provider == "openai":
        instance: LLMProvider = OpenAIProvider()
    elif provider == "gemini":
        instance = GeminiVertexProvider()
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider}")

    _CACHE[provider] = instance
    return instance


def current_provider_name() -> str:
    return os.getenv("LLM_PROVIDER", "gemini").lower()


def provider_label(name: str | None = None) -> str:
    name = (name or current_provider_name()).lower()
    return {"openai": "OpenAI", "gemini": "Gemini / Vertex"}.get(name, name)
