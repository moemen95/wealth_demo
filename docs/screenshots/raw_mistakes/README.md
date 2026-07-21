# Raw architecture — documented mistakes

Captured from the running app (Raw architecture, `middle` persona / Priya S.) with
`frontend/scripts/capture-raw-mistakes.mjs`. Raw is given the client's basic profile
and **current net worth** in its prompt, but has **no tools**, no forward-looking data
(maturities, market, live performance), and **no conversation memory**. With no
guardrails it answers everything confidently anyway — which is exactly the failure mode
below, and the contrast against the tool-grounded Skills/Agentic architectures.

Ground truth for `middle` (Priya S.): net worth **$70,200** = cash $45,200 + GIC
$25,000 − debt $0. Her GIC matures **2026-08-15 at 4.1%** — a fact that lives only in
the tools, so Raw cannot actually know it.

| Screenshot | Mistake it shows |
|---|---|
| `inconsistency-run-1.png` / `inconsistency-run-2.png` | **Inconsistency** — the same persona generates different insight cards (and different invented rates/projections) on each run; there is no stable answer. |
| `inaccurate-data.png` | **Inaccurate data** — asked for her GIC maturity date & renewal rate, Raw confidently invents specifics (e.g. a wrong date and a ~4.7% rate) and even offers to "enable auto-renew"; the real values are 2026-08-15 @ 4.1% and live only in the tools. |
| `jumps-to-conclusion-no-context.png` | **Jumps to a conclusion** — asked how to maximize return, Raw commits to a specific multi-tranche GIC ladder on an *assumed* horizon, never asking when she actually needs the money. |
| `context-flips-recommendation.png` | **Context-dependent** — supplying the missing horizon ("I need this exact $25,000 in 6 months for a home down payment") flips Raw's recommendation to a short 6-month product, proving its earlier commitment was premature — it never gathered the context a tool-using agent would. |
| `confusion.png` | **Confusion** — a compound, self-referential question makes Raw conflate her overlapping account/GIC figures. |
| `loses-context-longturn.png` | **No memory** — a fact stated in turn 1 (a $50,000 inheritance from aunt Rosa) is gone a couple of turns later, because Raw is stateless and no history is sent. |

Regenerate: with backend :8000 + frontend :3000 running, `cd frontend && pnpm capture:raw`.
