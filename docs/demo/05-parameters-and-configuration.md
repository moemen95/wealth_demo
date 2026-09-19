# 5 · Parameters and Configuration

## A. Client fields (the left panel)

Every field maps to a data-inventory reference so the demo can be traced to the data product.

| Field | Type / range | Ref | Used by the engine as |
|---|---|---|---|
| Segment | 30 segments + Custom | — | pre-fills all fields; Custom keeps the current numbers editable |
| Age | years | D1 | `current_age` |
| Retirement age | years | I10 | `retirement_age` |
| Life expectancy | years | I11 | `end_age` |
| Annual income | $/yr | D2 / I1 / I12 | informational (not in the MVP engine) |
| Total assets | $ | D3 / I2 | net worth = assets − liabilities |
| Total liabilities | $ | D5 / I3 | (editing either side keeps the identity; editing net worth adjusts assets) |
| Net worth | $ | D5 | `starting_net_worth` |
| …of which debt | $ | D20 | informational; clamped to ≤ liabilities |
| Monthly contributions | $/mo | D6 / I4 / I13 | `annual_contribution` (× 12) |
| Monthly expenses | $/mo | D7 / I5 / I14 | `annual_spend` (× 12) |
| Risk profile | Conservative / Balanced / Growth / Aggressive | D8 | sets the three fields below (presets in [03](03-simulation-engine.md)) |
| Asset mix (equity / fixed income / cash %) | % | D10 | informational in the demo |
| Expected return | % | D9 | `expected_return` |
| Volatility | % | D12 | `return_volatility` |
| Inflation | % | D13 / I16 | `inflation` |

**Submission:** edits are staged until **Run outlook** (or Enter). Selecting a segment, a quick-scenario
toggle or a dev control applies immediately. Native HTML validation is disabled on purpose — the engine
is the validator.

## B. Engine constants

| Constant | Value | Where |
|---|---|---|
| Runs (paths) | **5,000** default; 100–20,000 via dev controls | `DEFAULT_RUNS` |
| Seed | **42** default; any integer via dev controls | `DEFAULT_SEED` |
| Percentiles | P10 / P25 / P50 / P75 / P90 | `monteCarlo.ts` |
| Band thresholds | Good ≥ 90 · Borderline 75–89 · At Risk < 75 | `bandFor()` |
| Goal | 90 % | `GOAL` in `summary.ts`, gauge target |
| Save more | + $500 / month | `SCENARIO.save_more_monthly` |
| Retire earlier / later | ∓ 5 years | `SCENARIO.retire_earlier_years` (also the “work 5 more years” lever) |
| Live longer | + 5 years | `SCENARIO.live_longer_years` |
| Market downturn | return − 2 pts, volatility × 1.5, −20 % shock in year 2 | `SCENARIO.downturn` |
| Spend-less lever | − 10 % | `cut_spend` in `pipeline.ts` |
| Histogram | 12 bins up to the 95th percentile of ending balances | `OutcomeDistribution` |
| “Outlook updated” linger | 2.5 s | `READY_LINGER_MS` |

## C. Environment variables (root `.env`)

Read by `make …` (sourced into the shell), by the backend (`process.env`) and by the Vite dev server
(server-side only — nothing but `VITE_*` ever reaches the browser). Shell variables win over the file;
`ENV_FILE=… make …` selects another file. See `.env.example`.

### Wiring

| Variable | Default | Meaning |
|---|---|---|
| `FRONTEND_PORT` | 5173 | Vite dev-server port |
| `BACKEND_PORT` | 8787 | standalone backend port |
| `BACKEND_URL` | *(unset)* | when set, the frontend proxies `/api` here instead of mounting the handler in-process (`make dev` sets it) |
| `CORS_ORIGINS` | `http://localhost:5173` | comma-separated origins the backend accepts |
| `PREVIEW_PORT` | 4173 | `vite preview` port (`make preview`) |

### AI summary mode

| Variable | Default | Meaning |
|---|---|---|
| `LLM_MODE` (alias `LLM_PROVIDER`) | `templated` | `templated` · `openai` · `gemini` |
| `OPENAI_API_KEY` | — | required for `openai` |
| `OPENAI_MODEL` | `gpt-4o-mini` | any chat model; GPT-5 / o-series get `reasoning_effort: minimal` |
| `OPENAI_MAX_COMPLETION_TOKENS` | *(no cap)* | optional cap |
| `GOOGLE_CLOUD_PROJECT` | ADC / gcloud project | Vertex AI project |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` | a region, or `global` |
| `GEMINI_MODEL` | `gemini-2.5-flash` | any Gemini model on Vertex |
| `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT` | *(unset)* | impersonate this SA on top of whatever ADC is present |
| `GEMINI_THINKING_LEVEL` | `low` for 3.x+ | `minimal` · `low` · `medium` · `high` (3.x-era models) |
| `GEMINI_THINKING_BUDGET` | `0` (flash) / `128` (pro) for 2.5 | token budget (2.5-era models) |
| `GEMINI_MAX_OUTPUT_TOKENS` | *(no cap)* | optional cap; a `MAX_TOKENS` reply is retried once with 65,536 |

### Credentials for Gemini (once, outside `.env`)

```bash
gcloud auth application-default login --impersonate-service-account=sa-aichat@<project>.iam.gserviceaccount.com
```

or any other ADC source (`GOOGLE_APPLICATION_CREDENTIALS`, metadata server). Required IAM: the service
account needs **Vertex AI User** on the project; the human needs **Service Account Token Creator** on the SA.

## D. Make targets and npm scripts

| Target | Does |
|---|---|
| `make env` | create `.env` from `.env.example` |
| `make dev` | backend + frontend together, `/api` proxied to the backend; stops both on Ctrl-C |
| `make frontend` | Vite only (in-process `/api` unless `BACKEND_URL`) |
| `make backend` | standalone API: `/healthz`, `/api/config`, `/api/summary` |
| `make test` | 24 unit tests + a check that `server/*.ts` loads under Node’s type-stripping |
| `make typecheck` / `make build` / `make preview` | `tsc --noEmit` / production build to `dist/` / serve `dist/` + backend |
| `make calibrate` | prints the badge each of the 30 segments lands on (seed-data QA) |
| `make help` | lists everything above |

`npm run dev` alone (no Make, no `.env`) still runs the whole demo offline.

## E. Segment data (`src/data/segments.json`)

30 entries, 10 per persona, each with the same fields as the form plus `id`, `label`, `persona`.
Calibrated with `make calibrate` to **8 Good / 10 Borderline / 12 At Risk** so every badge colour is
represented within each persona band. Edit freely; re-run `make calibrate` to confirm coverage.
