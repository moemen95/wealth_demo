"""GET /personas and /personas/{id} — profile data for the UI (selector, chart)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..data_loader import VALID_PERSONAS, load_persona, persona_net_worth
from ..models.schemas import NetWorth, PersonaDetail, PersonaSummary

router = APIRouter()


def _summary(p: dict) -> PersonaSummary:
    return PersonaSummary(
        persona_id=p["persona_id"],
        name=p["name"],
        age=p["age"],
        tagline=p.get("tagline", ""),
        risk_profile=p["risk_profile"],
        portfolio_total=p["portfolio_total"],
        monthly_income=p["monthly_income"],
        monthly_expenses=p["monthly_expenses"],
    )


@router.get("/personas", response_model=list[PersonaSummary])
async def list_personas() -> list[PersonaSummary]:
    return [_summary(load_persona(pid)) for pid in VALID_PERSONAS]


@router.get("/personas/{persona_id}", response_model=PersonaDetail)
async def get_persona(persona_id: str) -> PersonaDetail:
    if persona_id not in VALID_PERSONAS:
        raise HTTPException(status_code=404, detail=f"Unknown persona '{persona_id}'")
    p = load_persona(persona_id)
    nw = persona_net_worth(persona_id)
    return PersonaDetail(
        **_summary(p).model_dump(),
        accounts=p.get("accounts", {}),
        allocation=p.get("allocation", {}),
        goals=p.get("goals", []),
        upcoming_events=p.get("upcoming_events", []),
        advisor=p.get("advisor"),
        debts=p.get("debts", []),
        net_worth=NetWorth(**nw),
    )
