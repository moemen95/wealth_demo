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
