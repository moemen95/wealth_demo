"""Portfolio skills — value, allocation, performance. All grounded in mock data."""
from __future__ import annotations

from ..data_loader import load_persona

CURRENCY = "CAD"


def get_portfolio_total(persona_id: str) -> dict:
    """Return the user's current total portfolio value."""
    data = load_persona(persona_id)
    return {"portfolio_total": data["portfolio_total"], "currency": CURRENCY}


def get_allocation(persona_id: str) -> dict:
    """Return the portfolio breakdown by asset class, with weights."""
    data = load_persona(persona_id)
    allocation = data.get("allocation", {}) or {}
    total = sum(allocation.values()) or 0
    breakdown = [
        {
            "asset_class": name,
            "value": value,
            "weight": round(value / total, 4) if total else 0.0,
        }
        for name, value in allocation.items()
    ]
    return {"currency": CURRENCY, "total": total, "breakdown": breakdown}


def get_performance(persona_id: str, window: str = "1Y") -> dict:
    """Return portfolio performance vs benchmark for a window (1M/3M/YTD/1Y)."""
    data = load_persona(persona_id)
    perf = data.get("performance", {}) or {}
    window = (window or "1Y").upper()
    entry = perf.get(window)
    if not entry:
        return {
            "window": window,
            "available_windows": list(perf.keys()),
            "message": "No performance data for that window.",
        }
    return {
        "window": window,
        "pct_change": entry["pct"],
        "benchmark_pct": entry["benchmark"],
        "vs_benchmark": round(entry["pct"] - entry["benchmark"], 4),
    }
