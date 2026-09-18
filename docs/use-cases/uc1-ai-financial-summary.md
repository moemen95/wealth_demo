# UC1 — AI Summary of the Future Outlook (Monte Carlo)

> **Scope update (2026-09-18):** UC1 is specifically the **AI summary of the Future chart** — a plain-language reading of a client's **projected retirement outlook driven by Monte Carlo simulation**. It lives on the **"My Future"** tab (alongside UC2's chart) and **may include additional visualizations** beyond the narrative (e.g. outcome distribution, shortfall/goal gauges, scenario comparisons). It is **not** the current net-worth snapshot.
>
> **Foundational step:** we start by **training a client-segmentation model** that groups clients into ~20–30 segments by their financial situation (net worth, assets, liabilities, debt, income, contributions, age, risk profile…). Each segment gets a representative simulation + summary, which (a) makes the AI summary fast and consistent, (b) gives us a persona catalog for design/testing, and (c) supports a "clients like you" framing.

## What UC1 produces

An **AI-generated summary + supporting visualizations** that explain the output of a **Monte Carlo retirement simulation** for a client (or their segment): whether they are on track, the probability their money lasts, the range of outcomes, the biggest levers, and what changes if they act. Non-conversational; rendered in the Future tab and expandable/interactive.

## Pipeline (two layers)

```
client data       → | 1. Segmentation model     | → segment_id (1..~30) + segment profile
                          |
segment/client    → | 2. Monte Carlo engine     | → simulated paths → percentile bands + KPIs
inputs (I#)       → |    (deterministic sim)    |
                          |
sim result        → | 3. AI summary (LLM)       | → narrative + highlights + viz specs
```

### 1. Client segmentation model (foundational)

- **Goal:** learn ~20–30 segments from client financial variables so every client maps to a segment with a precomputed baseline simulation & summary.
- **Features (from the EDW data product):** net worth (D5), assets & mix (D3/D10), liabilities & debt (D5/D20), income (D2), scheduled contributions (D6), monthly spend (D7), age (D1), registered/tax mix (D14), risk/investor profile (`D_MF_INVESTOR_CHAR`). See [../deliverables/data-product-persona-fields.md](../deliverables/data-product-persona-fields.md).
- **Approach (starter):** feature engineering → standardize → clustering (e.g. K-Means / GMM / hierarchical) with k≈20–30 chosen by silhouette/elbow + business review; label each segment with human-readable descriptors and a representative ("centroid") client.
- **Output:** `segment_id`, segment centroid profile, and a segment-level baseline simulation for fast rendering; individual clients can still be simulated live.

### 2. Monte Carlo simulation (the "Future" engine)

- Simulate net-worth paths from current age → life expectancy using contributions, spend, starting net worth, and **return/volatility assumptions** (per portfolio / asset class or a segment default). Accumulation → decumulation at retirement.
- Produce the chart series `G1..G13`: age axis, **median (P50)**, inner band (P25/P75), outer band (P10/P90), retirement marker, phase split, and KPIs — **% chance money lasts** (Good ≥90 / Borderline 75–89 / At Risk <75), projected net worth at 65 / end age, balance at retirement, withdrawal starting rate. See [../context/04-data-inventory.md](../context/04-data-inventory.md).
- Respect the engine assumptions/guardrails in [../context/05-projection-engine-assumptions.md](../context/05-projection-engine-assumptions.md) (today's-dollars, no-tax MVP, constant mix, ASP-only inflows).

### 3. AI summary + visualizations

- LLM narrates over the **deterministic simulation output** (never invents numbers): on-track verdict, probability framing, outcome range, biggest lever, and scenario deltas ("if you save $X more / retire N years later…").
- Emits **visualization specs** the UI renders: the fan chart, an outcome distribution (histogram / probability of ending balance), a goal/shortfall gauge, and scenario-comparison overlays. Expandable & interactive.

## Inputs (data contract)

Segmentation + simulation consume the EDW-bound data product. Key fields:

| Need | Field(s) | Availability |
|---|---|---|
| Starting net worth / assets / liabilities | D5, D3, D4, D20 | Yes / Partial (external) |
| Age / retirement age / life expectancy | D1, I10, I11 | Yes |
| Monthly contributions (PAC/ASP) | D6 | Yes |
| Monthly spend | D7 | Yes |
| Income | D2 | Partial (source TBC) |
| Asset class / portfolio & return/vol | D8, D9, D10, D12 | Partial / TBD (Wealth Studio) |
| Inflation | D13 | Yes |
| Risk / investor profile | `D_MF_INVESTOR_CHAR` | Yes (banded) |

## Output shape (illustrative)

```json
{
  "segment_id": 14,
  "segment_label": "Mid-career accumulator, moderate risk, mortgage-heavy",
  "horizon": {"current_age": 41, "retirement_age": 65, "end_age": 90},
  "simulation": {
    "runs": 10000,
    "series": [{"age": 41, "p10": 0, "p25": 0, "p50": 0, "p75": 0, "p90": 0}, "..."],
    "kpis": {"money_lasts_pct": 93, "band": "Good", "nw_at_65": 1973963, "nw_at_end": 200000}
  },
  "headline": "You're on track — about a 93% chance your money lasts to 90.",
  "narrative": "Based on 10,000 simulations of your current plan...",
  "highlights": [
    {"label": "Chance money lasts", "value": "93%", "band": "Good"},
    {"label": "Biggest lever", "value": "Contributions", "detail": "+$500/mo -> ~+5%"}
  ],
  "visualizations": [
    {"type": "fan_chart", "series_ref": "simulation.series"},
    {"type": "outcome_distribution", "metric": "ending_net_worth"},
    {"type": "goal_gauge", "target": 90, "current": 93}
  ],
  "scenario_readings": {
    "save_more": "Adding $500/mo raises the chance to ~96%...",
    "retire_earlier": "Retiring 5 years earlier lowers it to ~85%...",
    "live_longer": "Planning to 95 lowers it to ~88%..."
  },
  "disclaimers": ["Shown in today's dollars.", "Taxes not modelled.", "General information, not advice."]
}
```

## Guardrails (must)

- Narrate over deterministic simulation output — **never invent figures**; every number traces to a sim result or field.
- Respect all engine assumptions (today's-dollars, no-tax MVP, unverified externals).
- Prefer qualitative bands over false-precision dollar claims.
- General information, not advice; recommend a professional. Segment membership is for personalization, not a guarantee of individual outcome.

## Relationship to UC2

UC1 (this summary) and **UC2 (AI Future Charting)** both live on the Future tab and share the same Monte Carlo engine — UC2 is the interactive chart + scenario controls, UC1 is the AI reading/summary + supporting visualizations over the same simulation. Build them together; see [uc2-ai-future-charting.md](uc2-ai-future-charting.md).

## Success signals

- Narrative & viz reconcile 100% with the simulation output.
- Segment coverage: every client maps to a segment; live sim available for custom.
- Engagement on expand/scenario interactions; comprehension of "money lasts".

## Open items

See [../deliverables/uc1-open-questions.md](../deliverables/uc1-open-questions.md) and [../deliverables/questions-for-wealth-team.md](../deliverables/questions-for-wealth-team.md). A runnable **mock demo spec** is in [../deliverables/demo-prompt-uc1-future-simulation.md](../deliverables/demo-prompt-uc1-future-simulation.md).
