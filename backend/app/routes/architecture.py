"""GET /architectures — the agent/tool topology of each approach.

Introspected from the REAL objects (the skill registry + the built ADK agent
tree) so the frontend's "what runs under the hood" panel never drifts from the
code. Persona-independent: the plumbing is the same for every persona.
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..skills.registry import SKILL_SCHEMAS

router = APIRouter()


class ToolInfo(BaseModel):
    name: str
    description: str = ""


class AgentInfo(BaseModel):
    name: str
    kind: str  # "orchestrator" | "subagent" | "runtime"
    tools: list[ToolInfo] = Field(default_factory=list)


class ArchitectureTopology(BaseModel):
    key: str
    label: str
    tagline: str
    note: str = ""
    agents: list[AgentInfo] = Field(default_factory=list)


# name -> description for every tool we might surface. Seeded from the skill
# schemas and augmented with the two agentic-only tools.
def _tool_descriptions() -> dict[str, str]:
    desc = {s["function"]["name"]: s["function"].get("description", "") for s in SKILL_SCHEMAS}
    try:
        from ..skills.projection import project_strategy

        desc.setdefault("project_strategy", _first_line(project_strategy.__doc__))
    except Exception:  # noqa: BLE001
        pass
    try:
        from ..agents.context_tools import save_client_context

        desc.setdefault("save_client_context", _first_line(save_client_context.__doc__))
    except Exception:  # noqa: BLE001
        pass
    return desc


def _first_line(doc: str | None) -> str:
    return (doc or "").strip().split("\n", 1)[0].strip()


def _tool_name(tool) -> str:
    return (
        getattr(tool, "name", None)
        or getattr(getattr(tool, "func", None), "__name__", None)
        or type(tool).__name__
    )


def _agentic_agents(descs: dict[str, str]) -> list[AgentInfo]:
    """Walk the real root agent tree; fall back to a static description if the
    tree can't be built (e.g. missing provider deps at request time)."""
    try:
        from ..agents.root_agent import build_root_agent

        root = build_root_agent()
        agents = [AgentInfo(name=root.name, kind="orchestrator", tools=[])]
        for sa in root.sub_agents:
            tools = [
                ToolInfo(name=_tool_name(t), description=descs.get(_tool_name(t), ""))
                for t in (getattr(sa, "tools", []) or [])
            ]
            agents.append(AgentInfo(name=sa.name, kind="subagent", tools=tools))
        return agents
    except Exception:  # noqa: BLE001
        return [AgentInfo(name="wealth_root", kind="orchestrator", tools=[])]


@router.get("/architectures", response_model=list[ArchitectureTopology])
async def get_architectures() -> list[ArchitectureTopology]:
    descs = _tool_descriptions()
    skills_tools = [
        ToolInfo(name=s["function"]["name"], description=s["function"].get("description", ""))
        for s in SKILL_SCHEMAS
    ]
    return [
        ArchitectureTopology(
            key="raw",
            label="Raw",
            tagline="Prompt only — no grounding",
            note="A single LLM call with no tools and no grounded data.",
        ),
        ArchitectureTopology(
            key="skills",
            label="Skills",
            tagline="Structured tools, single-shot",
            agents=[AgentInfo(name="single-shot tool caller", kind="runtime", tools=skills_tools)],
        ),
        ArchitectureTopology(
            key="agentic",
            label="Agentic",
            tagline="Planner + subagents + memory",
            agents=_agentic_agents(descs),
        ),
    ]
