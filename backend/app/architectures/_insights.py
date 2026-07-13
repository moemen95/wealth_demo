"""Shared, tolerant parser for insight-card JSON emitted by the LLMs.

All three architectures ask the model to reply with a JSON array of insight
objects. Models are inconsistent (extra prose, missing fields, malformed chart
data), so this parser extracts the array best-effort and coerces every card into
the shape the API contract (``models.schemas.Insight``) expects. It never raises:
a parse failure yields a single fallback card so the UI always renders something.

Field coverage by ``kind``:
  * ``basic``    — title, body, cta
  * ``context``  — + context, data_points        (Skills)
  * ``scenario`` — + short_term, long_term, alternatives, recommended_action,
                   recommended_impact, and (optional) projection chart   (Raw/Agentic)
"""
from __future__ import annotations

import json
from typing import Any


def _s(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _str_list(value: Any) -> list[str] | None:
    if not isinstance(value, list):
        return None
    out = [_s(v) for v in value if _s(v)]
    return out or None


def _coerce_alternatives(value: Any) -> list[dict] | None:
    if not isinstance(value, list):
        return None
    out: list[dict] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        label = _s(item.get("label") or item.get("title"))
        detail = _s(item.get("detail") or item.get("body") or item.get("description"))
        if not label and not detail:
            continue
        out.append(
            {
                "label": label or "Option",
                "detail": detail,
                "tradeoff": _s(item.get("tradeoff")) or None,
                "recommended": bool(item.get("recommended", False)),
            }
        )
    return out or None


def _coerce_projection(value: Any) -> dict | None:
    """Validate a projection object; drop it entirely if malformed.

    Requires each series to have >= 2 numeric points, so a half-baked chart from
    the model never reaches the UI (the card just renders without a chart).
    """
    if not isinstance(value, dict):
        return None
    raw_series = value.get("series")
    if not isinstance(raw_series, list):
        return None

    series: list[dict] = []
    for s in raw_series:
        if not isinstance(s, dict):
            continue
        raw_points = s.get("points")
        if not isinstance(raw_points, list):
            continue
        points: list[dict] = []
        for p in raw_points:
            if not isinstance(p, dict):
                continue
            try:
                val = float(p.get("value"))
            except (TypeError, ValueError):
                continue
            points.append({"t": _s(p.get("t")), "value": val})
        if len(points) >= 2:
            series.append({"label": _s(s.get("label")) or "Series", "points": points})

    if not series:
        return None
    return {
        "unit": _s(value.get("unit")) or "CAD",
        "horizon_label": _s(value.get("horizon_label")),
        "series": series,
    }


def _coerce_card(item: dict, *, kind: str, grounded: bool | None) -> dict:
    card: dict[str, Any] = {
        "kind": kind,
        "title": _s(item.get("title"), "Insight"),
        "body": _s(item.get("body")),
        "cta": _s(item.get("cta"), "Ask a question"),
    }
    if grounded is not None:
        card["grounded"] = grounded

    if kind == "context":
        card["context"] = _s(item.get("context")) or None
        card["data_points"] = _str_list(item.get("data_points"))

    if kind == "scenario":
        card["short_term"] = _s(item.get("short_term")) or None
        card["long_term"] = _s(item.get("long_term")) or None
        card["alternatives"] = _coerce_alternatives(item.get("alternatives"))
        card["recommended_action"] = _s(item.get("recommended_action")) or None
        card["recommended_impact"] = _s(item.get("recommended_impact")) or None
        card["projection"] = _coerce_projection(item.get("projection"))

    return card


def parse_insight_cards(
    text: str, *, kind: str = "basic", grounded: bool | None = None, limit: int = 3
) -> list[dict]:
    """Extract up to ``limit`` insight cards from a model reply.

    ``kind`` selects which optional fields are populated; ``grounded`` stamps the
    card so the UI can badge ungrounded (Raw) scenarios. Always returns >= 1 card.
    """
    try:
        start = text.index("[")
        end = text.rindex("]") + 1
        data = json.loads(text[start:end])
        cards = [
            _coerce_card(item, kind=kind, grounded=grounded)
            for item in data[:limit]
            if isinstance(item, dict)
        ]
        if cards:
            return cards
    except (ValueError, json.JSONDecodeError):
        pass

    fallback = {
        "kind": kind,
        "title": "Insight",
        "body": text.strip()[:280] or "No structured insights returned.",
        "cta": "Ask a question",
    }
    if grounded is not None:
        fallback["grounded"] = grounded
    return [fallback]
