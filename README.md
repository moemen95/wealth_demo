# Wealth Insights Demo

Three progressively richer AI architectures — **Raw Prompting**, **Prompting +
Skills**, and an **Agentic App (Google ADK)** — answering the same wealth
questions across three personas, so you can *see* why architecture matters more
than vendor.

Runs on **OpenAI** (API key) **or** **Google Gemini on Vertex AI** (via GCP
service-account impersonation), switched by a single env variable
(`LLM_PROVIDER`) with **no code changes**.

> Full product/design intent lives in [`SPEC.md`](SPEC.md).

---

## What you get

| | Raw Prompting | Skills | Agentic (ADK) |
|---|---|---|---|
| Grounded numbers | ❌ hallucinates | ✅ tool-grounded | ✅ tool-grounded |
| Multi-step reasoning | ❌ | ⚠️ single-shot | ✅ planner + subagents |
| Session memory | ❌ | ❌ | ✅ |
| Proactive insights | ⚠️ generic | ⚠️ grounded | ✅ personalized |
| Tool trace / auditability | ❌ | ✅ | ✅ |

- **Home page** (`/`): persona selector, architecture toggle, provider badge,
  proactive insight cards, and a chat panel with a per-message tool trace.
- **Compare page** (`/compare`): one question → three architectures answer
  side-by-side. Watch Raw hallucinate, Skills return a bare number, and Agentic
  return a contextualized answer with a tool trace.
- **Live provider swap**: click the provider badge (or `POST /provider`) to flip
  OpenAI ↔ Gemini mid-demo — no restart.

---

## Architecture

```
Next.js 16 (frontend)  ──HTTP──▶  FastAPI (backend)
                                     │
                                     ▼
                        app/llm_provider.py   ← the ONLY place vendors differ
                          ├── OpenAIProvider          (Chat Completions + tools)
                          └── GeminiVertexProvider     (Vertex generateContent +
                                                        function_declarations,
                                                        SA impersonation)
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                             ▼
  raw_prompt.py                  skills.py                    agentic_adk.py
  (no tools)              (1 tool round, grounded)     (Google ADK: root agent +
                                                        portfolio/budgeting/
                                                        education subagents,
                                                        session memory)
```

Every architecture consumes `llm_provider.py`; none imports an SDK directly.
The agentic path uses **Google ADK** natively for Gemini and a **LiteLLM**
wrapper for OpenAI (`LiteLlm("openai/<model>")`).

---

## Prerequisites

- **Python 3.11+** and [`uv`](https://docs.astral.sh/uv/)
- **Node 20+** and **pnpm** (`corepack enable pnpm`)
- `gcloud` CLI — only for the Gemini/Vertex path
- Docker — only if you want the Compose path

---

## Quick start (Makefile — one command)

```bash
make setup     # install backend (uv) + frontend (pnpm) deps
make env       # create backend/.env from the example (edit it — see below)
make dev       # run backend (:8000) + frontend (:3000) together
```

Open **http://localhost:3000**. Run `make help` to see all targets.

> Prefer separate terminals? `make backend` and `make frontend`.

---

## Configure a provider

Edit `backend/.env` (created by `make env`, copied from `.env.example`).

### Option A — OpenAI (API key)

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
# OPENAI_BASE_URL=https://your-azure-or-proxy/v1   # optional
```

### Option B — Gemini on Vertex AI with SA impersonation (no long-lived keys)

```bash
# One-time GCP setup
gcloud auth application-default login
gcloud iam service-accounts add-iam-policy-binding \
  sa-agent@my-gcp-project.iam.gserviceaccount.com \
  --member='user:you@example.com' \
  --role='roles/iam.serviceAccountTokenCreator'
gcloud projects add-iam-policy-binding my-gcp-project \
  --member='serviceAccount:sa-agent@my-gcp-project.iam.gserviceaccount.com' \
  --role='roles/aiplatform.user'
```

```dotenv
LLM_PROVIDER=gemini
GOOGLE_CLOUD_PROJECT=my-gcp-project
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=true
GCP_IMPERSONATE_SERVICE_ACCOUNT=sa-agent@my-gcp-project.iam.gserviceaccount.com
GEMINI_MODEL=gemini-1.5-pro
```

The provider layer mints **1-hour short-lived tokens** via
`impersonated_credentials` — every call is attributable to both your identity
and the SA, and **no JSON keys touch disk**. For the ADK agentic path, ADC is
used directly; you can make ADC itself impersonate with
`gcloud config set auth/impersonate_service_account <SA>`.

---

## Docker Compose (either provider)

```bash
make env                         # ensure backend/.env exists
docker compose --env-file backend/.env up --build
```

The Gemini path mounts your host `~/.config/gcloud` read-only into the backend
container so impersonation works without baking any key into the image.

---

## API contract

| Method & path | Purpose |
|---|---|
| `GET /health` | Liveness + active provider |
| `GET /personas`, `GET /personas/{id}` | Profile data for the UI (selector, chart) |
| `GET /insights/{persona_id}?arch=raw\|skills\|agentic` | Proactive insight cards |
| `POST /chat` | Follow-up conversation (returns `reply`, `tool_calls`, `provider`, `timing_ms`) |
| `GET /provider`, `POST /provider` | Read / live-swap the active provider |

Interactive docs at **http://localhost:8000/docs**.

---

## Tests

```bash
make test        # or: cd backend && uv run pytest -q
```

Offline tests (data grounding, skill logic, provider selection by env, schema
normalization, graceful degradation) always run. The **live** integration tests
in `tests/test_llm_live.py` (SPEC §17 cases 1–4) run only when credentials are
configured for the active provider:

```bash
cd backend && LLM_PROVIDER=openai OPENAI_API_KEY=sk-... uv run pytest tests/test_llm_live.py
```

---

## Executive demo script (~8 min)

1. **Raw fails safely-critically.** Mass Affluent · Raw · *"Give me the total in
   my portfolio."* → the model hallucinates a number. *"In a regulated business
   this is a P1 waiting to happen — regardless of vendor."*
2. **Skills ground the answer.** Same question · Skills → correct total, but dry;
   ask *"Should I be worried about volatility?"* → generic, no memory.
3. **Agentic delivers the experience.** Same questions · Agentic → grounded,
   persona-tailored, references prior turns, shows a tool trace (portfolio →
   allocation → market). Use the **Compare** page to show all three at once.
4. **Provider swap live.** Click the provider badge to flip OpenAI ↔ Gemini —
   same story. *"Our architecture, not our vendor, is what makes this
   trustworthy."*

Closing: *"Raw prompting is a great prototype. Skills are a great API. Agents
are the product."*

---

## Project layout

```
backend/   FastAPI · provider layer · skills · ADK agents · mock persona data
frontend/  Next.js 16 · Tailwind · shadcn-style UI · Recharts · Zustand
```

See `SPEC.md` §6 for the annotated file tree.
