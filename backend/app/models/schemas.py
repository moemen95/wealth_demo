"""Pydantic request/response models — the API contract from SPEC §12."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

Architecture = Literal["raw", "skills", "agentic"]
PersonaId = Literal["first", "middle", "affluent", "affluent_no_goals"]


class ToolCall(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    result: Any = None


class InsightAlternative(BaseModel):
    label: str
    detail: str
    tradeoff: Optional[str] = None
    recommended: bool = False


class InsightSeriesPoint(BaseModel):
    t: str
    value: float


class InsightSeries(BaseModel):
    label: str
    points: list[InsightSeriesPoint] = Field(default_factory=list)


class InsightProjection(BaseModel):
    unit: str = "CAD"
    horizon_label: str = ""
    series: list[InsightSeries] = Field(default_factory=list)


class Insight(BaseModel):
    kind: Literal["basic", "context", "scenario"] = "basic"
    title: str
    body: str
    cta: str
    # Skills ("context") extras
    context: Optional[str] = None
    data_points: Optional[list[str]] = None
    # Agentic: assumptions stated when the client declined to share goals
    assumptions: Optional[list[str]] = None
    # Raw + Agentic ("scenario") extras
    short_term: Optional[str] = None
    long_term: Optional[str] = None
    alternatives: Optional[list[InsightAlternative]] = None
    recommended_action: Optional[str] = None
    recommended_impact: Optional[str] = None
    grounded: Optional[bool] = None
    # Agentic: scenario-specific follow-up questions for the drill-in chat
    follow_up_questions: Optional[list[str]] = None
    # Agentic scenario chart
    projection: Optional[InsightProjection] = None


class InsightAnalysisRow(BaseModel):
    scenario: str
    final_value: float
    total_contributions: float
    cagr: Optional[float] = None
    note: Optional[str] = None


class InsightAnalysis(BaseModel):
    """Cross-scenario comparison for the Agentic approach (one chart + summary)."""

    metric_label: str
    unit: str = "CAD"
    horizon_label: str = ""
    series: list[InsightSeries] = Field(default_factory=list)
    summary: list[InsightAnalysisRow] = Field(default_factory=list)
    chart_explanation: Optional[str] = None
    recommended_scenario: Optional[str] = None
    recommendation_rationale: Optional[str] = None
    comparison_summary: Optional[str] = None


class InsightsResponse(BaseModel):
    architecture: Architecture
    provider: str
    persona_id: str
    insights: list[Insight]
    analysis: Optional[InsightAnalysis] = None
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


class Debt(BaseModel):
    type: str
    balance: float
    rate: Optional[float] = None


class NetWorth(BaseModel):
    cash: float
    investments: float
    debt: float
    net_worth: float
    debts: list[Debt] = Field(default_factory=list)
    allocation: dict[str, float] = Field(default_factory=dict)


class PersonaDetail(PersonaSummary):
    accounts: dict[str, float]
    allocation: dict[str, float]
    goals: list[str]
    upcoming_events: list[dict[str, Any]]
    advisor: Optional[str] = None
    debts: list[Debt] = Field(default_factory=list)
    net_worth: Optional[NetWorth] = None
