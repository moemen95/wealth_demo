"""API-contract tests that don't require live LLM calls."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_personas_list_and_detail():
    r = client.get("/personas")
    assert r.status_code == 200
    assert len(r.json()) == 4

    detail = client.get("/personas/affluent").json()
    assert detail["portfolio_total"] > 1_000_000
    assert detail["allocation"]


def test_affluent_no_goals_mirrors_affluent_without_goals():
    affluent = client.get("/personas/affluent").json()
    no_goals = client.get("/personas/affluent_no_goals").json()
    assert no_goals["goals"] == []
    assert affluent["goals"]  # the original still ships preset goals
    assert no_goals["portfolio_total"] == affluent["portfolio_total"]
    assert no_goals["net_worth"] == affluent["net_worth"]


def test_persona_detail_exposes_net_worth_and_debts():
    first = client.get("/personas/first").json()
    assert first["net_worth"]["net_worth"] == -21250
    assert first["net_worth"]["cash"] == 2050
    # first carries credit-card + student-loan debt
    types = {d["type"] for d in first["debts"]}
    assert {"credit_card", "student_loan"} <= types

    affluent = client.get("/personas/affluent").json()
    assert affluent["net_worth"]["net_worth"] == 2_715_000
    assert affluent["debts"] == []


def test_unknown_persona_404():
    assert client.get("/personas/ghost").status_code == 404
    assert client.get("/insights/ghost").status_code == 404


def test_provider_toggle_endpoint():
    r = client.post("/provider", json={"provider": "openai"})
    assert r.status_code == 200
    assert r.json()["provider"] == "openai"
    assert client.post("/provider", json={"provider": "nope"}).status_code == 400


def test_chat_degrades_gracefully_without_credentials(monkeypatch):
    # No creds -> 200 with an error field, never a 500 (keeps the demo alive).
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    import app.llm_provider as llm

    llm._CACHE.clear()

    r = client.post(
        "/chat",
        json={"persona_id": "middle", "architecture": "raw", "message": "hi"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["error"]
    assert body["session_id"]
    assert body["provider"] == "openai"
