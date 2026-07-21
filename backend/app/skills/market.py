"""Market skill — a mocked market snapshot (no persona needed)."""
from __future__ import annotations

# Static snapshot so the demo is deterministic and offline-safe.
_SNAPSHOT = {
    "as_of": "2026-07-02",
    "indices": [
        {"name": "S&P/TSX Composite", "level": 22480, "day_pct": -0.012},
        {"name": "S&P 500", "level": 5210, "day_pct": -0.018},
        {"name": "10Y GoC Yield", "level": 3.42, "day_pct": 0.04},
    ],
    "headline": "Equities pulled back on rate-cut uncertainty; bonds firmer.",
    "context": (
        "Broad markets are down modestly over the past month on mixed inflation "
        "data. Volatility is elevated but within normal historical ranges."
    ),
}


def get_market_snapshot() -> dict:
    """Return headline indices and a one-line market context."""
    return _SNAPSHOT
