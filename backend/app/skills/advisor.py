"""Advisor skill — mocked warm handoff to a human advisor."""
from __future__ import annotations

from ..data_loader import load_persona


def book_advisor_meeting(persona_id: str, topic: str = "portfolio review") -> dict:
    """Book a (mock) meeting with a human wealth advisor."""
    data = load_persona(persona_id)
    advisor = data.get("advisor") or "an available wealth advisor"
    return {
        "status": "confirmed",
        "advisor": advisor,
        "topic": topic,
        "when": "Next available: within 2 business days",
        "confirmation_id": f"WM-{persona_id.upper()}-0042",
        "message": f"A meeting about '{topic}' has been requested with {advisor}.",
    }
