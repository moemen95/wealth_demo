# Tangerine Wealth — AI “Future Outlook” demo (UC1)

A mock, runnable web demo of the **AI summary of the Future Outlook**: a real Monte Carlo retirement
simulation for a chosen client, plus an AI-generated plain-language reading of it, rendered inside a
phone-frame mock of the Tangerine **“My Future”** tab. Runs fully offline; no API keys needed.

Spec: [`docs/deliverables/demo-prompt-uc1-future-simulation.md`](docs/deliverables/demo-prompt-uc1-future-simulation.md) ·
Use case: [`docs/use-cases/uc1-ai-financial-summary.md`](docs/use-cases/uc1-ai-financial-summary.md)

## Run it

```bash
npm i && npm run dev
```

Open <http://localhost:5173>. Left column = 30 client segments + **Custom** with every field editable;
right column = the phone. Any edit or toggle re-runs the Monte Carlo and regenerates the summary live.

### Make targets (all read the root `.env`)

Every target sources `.env` first, so one file configures both the backend and the frontend.
Shell variables still win (`LLM_MODE=gemini make dev`); `ENV_FILE=.env.staging make dev` picks another file.

```bash
make env        # create .env from .env.example (once)
make dev        # backend (:8787) + frontend (:5173) together; /api is proxied to the backend
make frontend   # Vite only — mounts /api in-process unless BACKEND_URL is set
make backend    # standalone API backend (the LLM proxy) — /healthz, /api/config, /api/summary
make test       # engine + summary-grounding unit tests
make build      # type-check + production build (dist/)
make preview    # serve dist/ + backend
make calibrate  # which badge each of the 30 segments lands on
make help       # everything above
```

Needs Node ≥ 22.18 (the backend runs its `.ts` files directly).

## What’s inside

```
src/
├── engine/                 pure TypeScript, no React — unit-tested
│   ├── rng.ts              seeded mulberry32 + Box–Muller normals (reproducible runs)
│   ├── monteCarlo.ts       the simulation: N runs × year-by-year, percentiles, KPIs, bands
│   ├── scenarios.ts        quick-scenario toggles (+$500/mo, −5y, +5y, market downturn)
│   ├── summary.ts          deterministic templated summary — every number comes from `facts`
│   ├── pipeline.ts         baseline → toggled → per-scenario readings → levers → summary
│   ├── llm.ts              optional LLM client (calls the local proxy route only)
│   ├── format.ts, types.ts
│   └── *.test.ts           vitest
├── data/segments.json      the 30 synthetic client segments (edit freely)
├── components/             ClientPanel, MobileFuture, FanChart, AiSummaryCard,
│                           ScenarioToggles, OutcomeDistribution, GoalGauge
└── App.tsx
server/
├── llm.ts                  providers (OpenAI, Gemini/Vertex via ADC) + the /api handler
└── index.ts                standalone backend: CORS, /healthz, mounts the handler
vite.config.ts              dev server; mounts the /api handler in-process or proxies to BACKEND_URL
Makefile                    targets that source .env for both processes
scripts/calibrate.ts        badge coverage check for the seed data
```

### The Monte Carlo (mock but real math)

Works in **today’s dollars**: each year samples a *real* return `r ~ Normal(expected_return − inflation, volatility)`, then

```
balance = balance × (1 + r) + contribution (if age < retirement) − spend (if age ≥ retirement)
```

floored at 0. A run “lasts” if the balance is > 0 at life expectancy. Per age we keep P10/P25/P50/P75/P90
(the fan chart), and the KPIs are: **% of runs with money at end age** (Good ≥ 90 / Borderline 75–89 /
At Risk < 75), median net worth at retirement / at 65 / at end age, and the withdrawal starting rate.
Default 5,000 runs, seed 42 — both adjustable under *Dev controls*. The engine deliberately mirrors the
MVP POC’s simplifications (no taxes, constant mix, flat real contributions) — see
[`docs/context/05-projection-engine-assumptions.md`](docs/context/05-projection-engine-assumptions.md).

Scenario toggles: **Save more** +$500/mo · **Retire earlier** −5y · **Live longer** +5y ·
**Market downturn** = mean −2 pts, volatility ×1.5, and a one-off −20% shock in year 2.

### The AI summary

Default is a **deterministic templated generator** (`engine/summary.ts`). It first registers every
number it is allowed to mention in a `facts` map, then composes the headline, 2–4 sentence narrative,
highlight chips, “Why?” grounding list, scenario readings and the delta sentence (when toggles are on)
from those facts only. `summary.test.ts` extracts every numeric token from the copy and fails if any
one of them isn’t a registered fact — that is the grounding guarantee. Tone varies by band and by
distance from the 90 % goal.

The copy always carries the guardrails from the projection-engine doc: *today’s dollars*, *taxes not
modelled*, *general information, not advice*; segment membership is personalization, not a guarantee.

### Optional real-LLM mode

`POST /api/summary` lives in `server/llm.ts` and is served either by the standalone backend
(`make backend` / `make dev`) or in-process by the Vite dev server (`npm run dev`). The browser sends
only the `facts` + guardrails; the server calls the provider with a JSON-only prompt and returns
`{headline, narrative}` in the same shape. Credentials never reach the client. Any error or malformed
reply silently falls back to the templated copy; the page header and the card footer show which mode
is active, and both processes print the resolved provider on start.

**Gemini on Google Cloud (Vertex AI) — uses the credentials already in your environment:**

```bash
# once: ADC with service-account impersonation (or any ADC / GOOGLE_APPLICATION_CREDENTIALS / metadata server)
gcloud auth application-default login --impersonate-service-account=sa-aichat@<project>.iam.gserviceaccount.com

LLM_MODE=gemini GOOGLE_CLOUD_PROJECT=<project> npm run dev
# optional: GOOGLE_CLOUD_LOCATION=us-central1  GEMINI_MODEL=gemini-2.5-flash
# optional: GOOGLE_IMPERSONATE_SERVICE_ACCOUNT=… to impersonate explicitly on top of plain ADC
```

No API key is involved: `google-auth-library` resolves ADC (an `impersonated_service_account` ADC
file is handled natively) and mints a short-lived access token for the Vertex AI `generateContent`
REST endpoint. The project falls back to the ADC/gcloud project if `GOOGLE_CLOUD_PROJECT` is unset.

**OpenAI:**

```bash
LLM_MODE=openai OPENAI_API_KEY=sk-... npm run dev    # optional OPENAI_MODEL=gpt-4o-mini
```

Both can also live in `.env` (see `.env.example`); shell variables take precedence.

## Editing the segments

`src/data/segments.json` — 30 entries, 10 per persona (Elena / Elijah / Esme). Each has the same fields
the left panel edits (age, retirement age, life expectancy, assets, liabilities, debt, income,
contributions, expenses, asset mix, expected return, volatility, inflation, risk profile). After editing,
run `npm run calibrate` to confirm the set still covers green / amber / red badges.

## Swap-in points (how this graduates to real data)

| Stand-in in this demo | Real thing | Where to swap |
|---|---|---|
| `src/data/segments.json` (30 hand-made segments) | **ML client-segmentation model** — `segment_id` + centroid profile per client (UC1 spec §1) | `src/App.tsx` → `SEGMENTS`; fields map 1:1 to the `ClientInputs` type, which mirrors `D#` refs in the [data product](docs/deliverables/data-product-persona-fields.md) |
| Client-side Monte Carlo with per-profile return/vol presets | **Real engine + Wealth Studio capital-market assumptions** (D12, still TBD) | `src/engine/monteCarlo.ts` `simulate()` / `toSimInputs()` — replace with a call to the engine API returning the same `SimResult` |
| Templated summary | LLM over the same `facts` (already wired behind `LLM_MODE=openai`) | `src/engine/llm.ts` + `vite.config.ts` proxy |

The `SummaryOutput` type in `src/engine/types.ts` is the UC1 “Output shape”, so the mock and the real
service stay interchangeable.
