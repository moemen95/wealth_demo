"""Tests for the /architectures topology endpoint (agents + tools per approach)."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_architectures_lists_all_three_approaches():
    r = client.get("/architectures")
    assert r.status_code == 200
    data = r.json()
    keys = [a["key"] for a in data]
    assert keys == ["raw", "skills", "agentic"]


def test_raw_has_no_tools_but_a_note():
    raw = next(a for a in client.get("/architectures").json() if a["key"] == "raw")
    assert raw["agents"] == []
    assert raw["note"]


def test_skills_exposes_the_flat_tool_set():
    from app.skills.registry import SKILL_SCHEMAS

    skills = next(a for a in client.get("/architectures").json() if a["key"] == "skills")
    assert len(skills["agents"]) == 1
    tool_names = {t["name"] for t in skills["agents"][0]["tools"]}
    assert tool_names == {s["function"]["name"] for s in SKILL_SCHEMAS}


def test_agentic_mirrors_the_real_agent_tree():
    agentic = next(a for a in client.get("/architectures").json() if a["key"] == "agentic")
    by_name = {a["name"]: a for a in agentic["agents"]}
    # orchestrator + the four subagents
    assert by_name["wealth_root"]["kind"] == "orchestrator"
    assert by_name["wealth_root"]["tools"] == []
    portfolio_tools = {t["name"] for t in by_name["portfolio_agent"]["tools"]}
    assert "project_strategy" in portfolio_tools
    assert "get_portfolio_total" in portfolio_tools
    assert {t["name"] for t in by_name["context_agent"]["tools"]} == {"save_client_context"}
    # tool descriptions are populated from the registry
    assert all(t["description"] for t in by_name["portfolio_agent"]["tools"])
