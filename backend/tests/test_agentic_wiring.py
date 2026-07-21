import json
import pytest
from fastapi.testclient import TestClient
import app.architectures.agentic_adk as ak
from app.main import app

OBJ = {
  "metric": "portfolio_value",
  "metric_label": "Projected portfolio value",
  "horizon_years": 10,
  "recommended_scenario": "Balanced",
  "recommendation_rationale": "best risk/return fit",
  "comparison_summary": "growth beats conservative but with more volatility",
  "scenarios": [
    {"title":"Conservative","body":"b","short_term":"s","long_term":"l","recommended_action":"ladder GICs","annual_return":0.03,"monthly_contribution":7000},
    {"title":"Balanced","body":"b","short_term":"s","long_term":"l","recommended_action":"60/40","annual_return":0.06,"monthly_contribution":7000},
    {"title":"Growth","body":"b","short_term":"s","long_term":"l","recommended_action":"equity tilt","annual_return":0.09,"monthly_contribution":7000},
  ],
}

async def fake_run(persona_id, session_id, message, attempts=3):
    return ("here is the plan: " + json.dumps(OBJ), [])

async def fake_state(persona_id, session_id):
    return {"client_context": "retire in 3 years", "declined": False}

def test_insights_endpoint_returns_analysis(monkeypatch):
    monkeypatch.setattr(ak, "_run_with_retry", fake_run)
    monkeypatch.setattr(ak, "read_session_context", fake_state)
    c = TestClient(app)
    r = c.get("/insights/affluent?arch=agentic&session_id=sid-1")
    assert r.status_code == 200
    d = r.json()
    # 3 scenario cards, no alternatives / no per-card projection
    assert len(d["insights"]) == 3
    for card in d["insights"]:
        assert card["kind"] == "scenario"
        assert card.get("alternatives") in (None, [])
        assert card.get("projection") is None
        assert card["recommended_action"]
        assert "Projected portfolio value" in card["recommended_impact"]
    # analysis present with 3 deterministic series (Y0..Y10) and a recommendation
    a = d["analysis"]
    assert a is not None
    assert a["metric_label"] == "Projected portfolio value"
    assert len(a["series"]) == 3
    for s in a["series"]:
        assert len(s["points"]) == 11
        assert s["points"][0]["value"] == 2450000.0  # grounded affluent start
    finals = {row["scenario"]: row["final_value"] for row in a["summary"]}
    assert finals["Growth"] > finals["Balanced"] > finals["Conservative"]
    assert a["recommended_scenario"] == "Balanced"
