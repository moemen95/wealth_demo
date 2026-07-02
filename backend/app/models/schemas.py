"""Pydantic request/response models — the API contract from SPEC §12."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

Architecture = Literal["raw", "skills", "agentic"]
PersonaId = Literal["first", "middle", "affluent"]


class ToolCall(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    result: Any = None


class Insight(BaseModel):
    title: str
    body: str
    cta: str


class InsightsResponse(BaseModel):
    architecture: Architecture
    provider: str
    persona_id: str
    insights: list[Insight]
    tool_calls: list[ToolCall] = Field(default_factory=list)
    timing_ms: int
    error: Optional[str] = None


class ChatRequest(BaseModel):
    persona_id: PersonaId
    architecture: Architecture
    session_id: Optional[str] = None
    message: str


class ChatResponse(BaseModel):
    reply: str
    provider: str
    architecture: Architecture
    session_id: str
    tool_calls: list[ToolCall] = Field(default_factory=list)
    timing_ms: int
    error: Optional[str] = None


class PersonaSummary(BaseModel):
    persona_id: str
    name: str
    age: int
    tagline: str
    risk_profile: str
    portfolio_total: float
    monthly_income: float
    monthly_expenses: float


class PersonaDetail(PersonaSummary):
    accounts: dict[str, float]
    allocation: dict[str, float]
    goals: list[str]
    upcoming_events: list[dict[str, Any]]
    advisor: Optional[str] = None
