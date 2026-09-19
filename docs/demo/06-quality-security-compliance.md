# 6 · Quality, Security and Compliance

## Automated tests (24, ~0.4 s)

`make test` / `npm test` — Vitest, plus a Node type-stripping import check of the backend.

### Engine (`src/engine/monteCarlo.test.ts`, 10 tests)

| Test | Guarantees |
|---|---|
| Zero-volatility path equals the deterministic compound-growth curve (every year, all percentiles) | the year-by-year arithmetic is right |
| Same seed ⇒ identical series and KPIs; different seed ⇒ different paths | reproducibility is real, randomness is real |
| P10 ≤ P25 ≤ P50 ≤ P75 ≤ P90 at every age | percentile computation |
| Higher contributions ⇒ higher median at retirement | monotonicity |
| Higher spend ⇒ lower chance money lasts | monotonicity |
| Guaranteed ruin ⇒ 0 %, At Risk, no negative balances, runs-out age set | edge handling |
| Band thresholds at 100/90/89/75/74 | Good/Borderline/At Risk boundaries |
| Client → engine conversion (% → decimal, monthly → annual) | data contract |
| Each toggle changes exactly the right input; downturn lowers the chance | scenarios |

### Summary (`src/engine/summary.test.ts`, 7 tests)

| Test | Guarantees |
|---|---|
| **Grounding**: every numeric token in headline, narrative, delta, scenario readings, chips and “Why?” is a registered fact — for borderline, at-risk and comfortably-funded clients, with and without toggles | the copy cannot invent numbers |
| Output matches the UC1 shape (ids, horizon, runs, KPIs, 3 visualizations, 3 chips, 3 disclaimers) | contract with the real service |
| Headline carries the chance and the band’s tone | consistency with the badge |
| 2–4 sentences without toggles; delta sentence present (and grounded) with toggles | copy structure |
| Grounding helper accepts formatted facts, flags invented numbers | the runtime check used on LLM output |

### Server (`server/llm.test.ts`, 7 tests)

Vertex endpoint for regional vs. `global` locations; thinking control per model family and env override;
Gemini reply parsing (plain / fenced / thought parts), truncation diagnosis with token usage, blocked prompts.

### Type safety

`tsc --noEmit` on the whole project with `strict`, `verbatimModuleSyntax` and `erasableSyntaxOnly`
(the last one guarantees `server/*.ts` runs under Node without a build step).

## Grounding as a control

Two independent enforcement points:

1. **Build time** — the templated generator can only use numbers it registered; tests scan its output.
2. **Run time** — every LLM reply is scanned in the browser with the same helper; any non-fact number
   discards the reply (logged as `[llm] discarding reply with un-grounded numbers`).

Together with the fact that the LLM only ever *rewrites* a correct draft, this is the answer to
*“how do we know the AI isn’t hallucinating a client’s retirement number?”*

## Credential and data handling

| Concern | How it is handled |
|---|---|
| LLM credentials | read only on the server (`server/llm.ts` / Vite dev server); never in `import.meta.env`; browser calls `/api/*` only |
| Gemini auth | Google ADC; supports impersonated service accounts — the same pattern as the EDW access in the data-product work; short-lived tokens, no long-lived key in the repo |
| `.env` | git-ignored; `.env.example` documents every variable with no secrets |
| What the LLM sees | the `facts` map (≈ 30 numbers), `band`, `segment_label`, the draft text and the guardrails — **no PII**, no raw transactions, no account identifiers |
| Client data | none in the demo: inputs are synthetic segments or form values typed by the presenter |
| CORS | backend allows only `CORS_ORIGINS`; no header for other origins |
| Third-party calls | at most one LLM request per run; circuit breaker stops retries after quota/auth failures |

## Compliance guardrails in the output

From [`../context/05-projection-engine-assumptions.md`](../context/05-projection-engine-assumptions.md),
always present on screen and in the prompt:

- *Shown in today’s dollars.* — inflation caveat on every future value.
- *Taxes not modelled.* — registered accounts are not given tax treatment; the copy never implies it.
- *General information, not advice.* — no personalised recommendation; the “biggest lever” is framed as
  what the simulation shows, not as instruction.
- Qualitative bands (Good / Borderline / At Risk) are used in preference to false precision.
- Segment membership is personalisation, not a guarantee of individual outcome.

## Accessibility and UX notes

- The status gadget is `role="status" aria-live="polite"`; the phone screen sets `aria-busy` while work is in flight.
- Every interactive control is a native `<button>`, `<input>`, `<select>` or labelled `<label>`.
- Colour is never the only signal: bands are also named (“Good”, “Borderline”, “At Risk”).

## Known limitations (be upfront)

- Synthetic data; no tax, product, fee or guaranteed-income modelling (mirrors the MVP engine).
- The LLM rewrite adds ~1.5–3 s per run and an external dependency; the demo works without it.
- Grounding checks numbers, not claims — a rewrite could still phrase a fact awkwardly (the draft-rewrite
  prompt and tone rules are the mitigation; human review of prompt changes is recommended).
- The Node backend is a dev-grade proxy (no auth, no rate limiting) — fine for a demo, not a service.
