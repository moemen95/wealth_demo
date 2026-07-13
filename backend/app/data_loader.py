"""Loads the mock persona profiles from the local JSON files."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_DATA_DIR = Path(__file__).resolve().parent / "data"

_PERSONA_FILES = {
    "first": "persona_first.json",
    "middle": "persona_middle.json",
    "affluent": "persona_affluent.json",
}

VALID_PERSONAS = tuple(_PERSONA_FILES.keys())


@lru_cache
def load_persona(persona_id: str) -> dict:
    """Return the full profile dict for a persona.

    Raises KeyError for an unknown persona so callers can map it to a 404.
    """
    key = (persona_id or "").lower()
    if key not in _PERSONA_FILES:
        raise KeyError(f"Unknown persona '{persona_id}'. Valid: {VALID_PERSONAS}")
    path = _DATA_DIR / _PERSONA_FILES[key]
    with path.open() as f:
        return json.load(f)


def persona_summary(persona_id: str) -> str:
    """A compact one-paragraph profile used to prime prompts / instructions."""
    p = load_persona(persona_id)
    return (
        f"persona_id={p['persona_id']}, name={p['name']}, age={p['age']}, "
        f"life_stage=\"{p.get('tagline', '')}\", "
        f"monthly_income={p['monthly_income']}, monthly_expenses={p['monthly_expenses']}, "
        f"risk_profile={p['risk_profile']}, goals={', '.join(p.get('goals', []))}"
    )


def persona_net_worth(persona_id: str) -> dict:
    """Net-worth breakdown derived from a persona's static profile.

    Single source of truth for the frontend snapshot widget AND Raw's prompt, so
    the numbers the client "sees" always match the numbers Raw reasons over.
    ``cash`` = chequing + savings; ``investments`` = portfolio total;
    ``debt`` = sum of outstanding debt balances; ``net_worth`` = cash + investments
    − debt (can be negative). Forward-looking fields (performance, upcoming events)
    are deliberately excluded — those are tool-only.
    """
    p = load_persona(persona_id)
    accounts = p.get("accounts", {})
    cash = float(accounts.get("chequing", 0)) + float(accounts.get("savings", 0))
    investments = float(p.get("portfolio_total", 0))
    debts = [
        {
            "type": d.get("type", "debt"),
            "balance": float(d.get("balance", 0)),
            "rate": d.get("rate"),
        }
        for d in p.get("debts", [])
    ]
    debt_total = sum(d["balance"] for d in debts)
    return {
        "cash": cash,
        "investments": investments,
        "debt": debt_total,
        "net_worth": cash + investments - debt_total,
        "debts": debts,
        "allocation": p.get("allocation", {}),
    }


def persona_client_brief(persona_id: str) -> str:
    """Basic profile + current net worth, formatted for Raw's prompt.

    Raw is given exactly what a client would state up front: who they are and
    their current financial picture. It gets NO forward-looking data (upcoming
    maturities, live performance, market outlook) — those stay tool-only, so Raw
    must guess when asked about them.
    """
    p = load_persona(persona_id)
    nw = persona_net_worth(persona_id)
    alloc = nw["allocation"]
    alloc_str = (
        ", ".join(f"{k} ${v:,.0f}" for k, v in alloc.items()) if alloc else "none"
    )
    debt_str = (
        ", ".join(f"{d['type']} ${d['balance']:,.0f}" for d in nw["debts"])
        if nw["debts"]
        else "none"
    )
    return (
        f"name={p['name']}, age={p['age']}, life_stage=\"{p.get('tagline', '')}\", "
        f"risk_profile={p['risk_profile']}, goals={', '.join(p.get('goals', []))}. "
        f"Monthly income ${p['monthly_income']:,.0f}, monthly expenses "
        f"${p['monthly_expenses']:,.0f}. "
        f"Net worth ${nw['net_worth']:,.0f} = cash ${nw['cash']:,.0f} + investments "
        f"${nw['investments']:,.0f} − debt ${nw['debt']:,.0f}. "
        f"Investment holdings: {alloc_str}. Debts: {debt_str}."
    )
