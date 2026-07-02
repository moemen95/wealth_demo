# Wealth Insights Demo — Implementation Spec

> **Audience:** AI Engineers building the demo, and executives who will see it.

> **Goal:** Show how three progressively richer architectures — Raw Prompting, Prompting + Skills, and an Agentic App (Google ADK) — impact the quality, safety, and usefulness of wealth insights across three personas.

> **Multi-provider:** Runs on **OpenAI** (API key) OR **Google Gemini on Vertex AI / Agent Platform** (via GCP service account impersonation), switched by a single env variable.

---

## 1. Project Overview

We are building a **single web app** that lets a presenter:

1. Pick a **persona** (First / Middle / Mass Affluent).
2. Pick an **architecture** (Raw Prompting / Prompting + Skills / Agentic ADK).
3. See **Initial Insights** proactively surfaced for that persona.
4. Have a **follow-up conversation** with the agent.
5. Compare answers **side-by-side** across architectures for the same question.

The demo doubles as an **internal education artifact** on why raw prompting alone is rarely enough for regulated, data-grounded, action-oriented experiences like Wealth.

### Learning Objectives
- Make the failure modes of raw prompting **visible and visceral** (hallucinated portfolio values, generic advice, no personalization).
- Show how **Skills** (structured tools + schemas) fix grounding but limit orchestration.
- Show how an **Agentic architecture** (planning, tool calling, subagents, memory) unlocks true assistant-like behavior.

---

## 2. Personas (Recap)

| Persona | Life Stage | Core Concern | Data We Hold |
|---|---|---|---|
| **First** | Young, early career | High debt ratio, low savings | Chequing, credit card balances, paycheck cadence |
| **Middle** | Mid-career | Cash-heavy, liquidity concern, GIC renewals | Savings balance, GIC maturity, risk profile |
| **Mass Affluent** | Late-career / pre-retiree | Portfolio performance, volatility, legacy | Investment portfolio (>$1MM), asset allocation, advisor |

Each persona has a **mock financial profile JSON** used to ground the agents.

---

## 3. Sample Questions the Agent Must Handle

1. *"How much money should I save from my monthly income?"*
2. *"Give me the total in my portfolio."*
3. *"Should I pay down debt or invest?"* (First)
4. *"My GIC is maturing — what should I do?"* (Middle)
5. *"Markets are down. Am I okay?"* (Mass Affluent)

The point of the demo is to show these **same questions produce dramatically different answers** across the three architectures.

---

## 4. Tech Stack

| Layer | Choice                                                                                                                                                      | Why |
|---|-------------------------------------------------------------------------------------------------------------------------------------------------------------|---|
| Frontend | **Next.js 16 (App Router) + React + TypeScript**                                                                                                            | Fast, executive-grade UI |
| UI Kit | **Tailwind CSS + shadcn/ui + lucide-react**                                                                                                                 | Clean, modern, minimal setup |
| State | Zustand (or React context)                                                                                                                                  | Lightweight |
| Backend | **FastAPI (Python 3.12+)**                                                                                                                                  | Best fit for LLM + ADK |
| LLM | **Gemini (via Vertex AI on Agent Platform with GCP Service Account Impersonation) OR OpenAI (via API key)** — provider selected at runtime via env variable | Vendor-flexible, exec-friendly |
| Agentic Framework | **Google ADK** (`google-adk`) — native Gemini path; LiteLLM wrapper for OpenAI                                                                              | Required by acceptance criteria |
| Mock Data | Local JSON files                                                                                                                                            | No DB needed for demo |
| Charts | Recharts                                                                                                                                                    | Portfolio visuals |
| Package Mgmt | `uv` (backend), `pnpm` (frontend)                                                                                                                           | Fast |
| Runtime | Docker Compose and Makefile to run backend & frontend through commands locally                                                                              | One-command demo |

---

## 5. LLM Provider Configuration

The demo supports **two LLM providers** switched via a single env variable (`LLM_PROVIDER`), so all three architectures (Raw / Skills / Agentic) can run on either **OpenAI** or **Google Gemini on Vertex AI (Agent Platform)** without code changes. This is critical because:

- Executives want to see the same demo tell the same story regardless of vendor.
- Enterprise environments frequently mandate **no long-lived credentials** — GCP **service account impersonation** gives us short-lived tokens with a clean audit trail.
- We want the option to demo **OpenAI's reasoning** side-by-side with **Gemini's ADK-native tooling**.

### Environment Variables

| Variable | Values / Example | Required When | Description |
|---|---|---|---|
| `LLM_PROVIDER` | `openai` or `gemini` | **Always** | Selects the provider at runtime |
| `OPENAI_API_KEY` | `sk-...` | `LLM_PROVIDER=openai` | OpenAI API key |
| `OPENAI_MODEL` | `gpt-5-nano` (default) | Optional | Override default OpenAI model |
| `GOOGLE_CLOUD_PROJECT` | `my-gcp-project` | `LLM_PROVIDER=gemini` | GCP project hosting Vertex AI / Agent Platform |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` | `LLM_PROVIDER=gemini` | Vertex AI region |
| `GOOGLE_APPLICATION_CREDENTIALS` | `/path/to/adc.json` | Optional | Local ADC file if not using `gcloud auth` |
| `GCP_IMPERSONATE_SERVICE_ACCOUNT` | `sa-agent@project.iam.gserviceaccount.com` | When using impersonation | Target SA with `roles/aiplatform.user` |
| `GEMINI_MODEL` | `gemini-1.5-pro` (default) | Optional | Override default Gemini model |
| `GOOGLE_GENAI_USE_VERTEXAI` | `true` | `LLM_PROVIDER=gemini` | Routes `google-genai` SDK & ADK through Vertex AI |

### Provider Abstraction Layer

Create `backend/app/llm_provider.py` — a thin abstraction that returns the correct client and model handle based on `LLM_PROVIDER`. Every architecture (raw / skills / agentic) consumes this abstraction rather than importing SDKs directly.

```python
# backend/app/llm_provider.py
import os
from typing import Protocol, Any, Optional

class LLMProvider(Protocol):
    name: str
    model: str
    def complete(self, messages: list, tools: Optional[list] = None) -> Any: ...
    def stream(self, messages: list, tools: Optional[list] = None): ...

# ---------- OpenAI ----------
class OpenAIProvider:
    name = 'openai'
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=os.environ['OPENAI_API_KEY'],
            base_url=os.getenv('OPENAI_BASE_URL'),  # None → default OpenAI endpoint
        )
        self.model = os.getenv('OPENAI_MODEL', 'gpt-4o')

    def complete(self, messages, tools=None):
        return self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=tools or [],
        )

    def stream(self, messages, tools=None):
        return self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=tools or [],
            stream=True,
        )

# ---------- Gemini on Vertex AI (Agent Platform) ----------
class GeminiVertexProvider:
    name = 'gemini'
    def __init__(self):
        from google import genai
        credentials = self._build_credentials()
        self.client = genai.Client(
            vertexai=True,
            project=os.environ['GOOGLE_CLOUD_PROJECT'],
            location=os.environ.get('GOOGLE_CLOUD_LOCATION', 'us-central1'),
            credentials=credentials,
        )
        self.model = os.getenv('GEMINI_MODEL', 'gemini-1.5-pro')

    def _build_credentials(self):
        # If GCP_IMPERSONATE_SERVICE_ACCOUNT is set → mint short-lived tokens via impersonation.
        # Otherwise fall back to Application Default Credentials (ADC).
        import google.auth
        from google.auth import impersonated_credentials

        source_credentials, _ = google.auth.default(
            scopes=['https://www.googleapis.com/auth/cloud-platform']
        )
        target_sa = os.getenv('GCP_IMPERSONATE_SERVICE_ACCOUNT')
        if not target_sa:
            return source_credentials  # plain ADC

        return impersonated_credentials.Credentials(
            source_credentials=source_credentials,
            target_principal=target_sa,
            target_scopes=['https://www.googleapis.com/auth/cloud-platform'],
            lifetime=3600,
        )

    def complete(self, messages, tools=None):
        return self.client.models.generate_content(
            model=self.model, contents=messages, config={'tools': tools or []},
        )

    def stream(self, messages, tools=None):
        return self.client.models.generate_content_stream(
            model=self.model, contents=messages, config={'tools': tools or []},
        )

# ---------- Factory ----------
def get_provider() -> LLMProvider:
    provider = os.getenv('LLM_PROVIDER', 'gemini').lower()
    if provider == 'openai':
        return OpenAIProvider()
    if provider == 'gemini':
        return GeminiVertexProvider()
    raise ValueError(f'Unknown LLM_PROVIDER: {provider}')
```

### GCP Service Account Impersonation Setup

No long-lived JSON keys required. The developer (or the CI runner) authenticates once with their own identity; the app then **impersonates** a service account that holds the Vertex AI permissions.

```bash
# 1. Authenticate as yourself (one-time)
gcloud auth application-default login

# 2. Grant your user the right to impersonate the target SA
gcloud iam service-accounts add-iam-policy-binding \
  sa-agent@my-gcp-project.iam.gserviceaccount.com \
  --member='user:you@example.com' \
  --role='roles/iam.serviceAccountTokenCreator'

# 3. Ensure the target SA has Vertex AI access
gcloud projects add-iam-policy-binding my-gcp-project \
  --member='serviceAccount:sa-agent@my-gcp-project.iam.gserviceaccount.com' \
  --role='roles/aiplatform.user'

# 4. Point the app at the SA
export LLM_PROVIDER=gemini
export GOOGLE_CLOUD_PROJECT=my-gcp-project
export GOOGLE_CLOUD_LOCATION=us-central1
export GOOGLE_GENAI_USE_VERTEXAI=true
export GCP_IMPERSONATE_SERVICE_ACCOUNT=sa-agent@my-gcp-project.iam.gserviceaccount.com
```

> ✅ Tokens are short-lived (default 1h in the code above) and every call is attributable to both the developer identity and the SA — clean audit trail, zero secrets on disk.

### Architecture Compatibility Matrix

| Architecture | OpenAI | Gemini (Vertex) | Notes |
|---|:---:|:---:|---|
| Raw Prompting | ✅ OpenAI Chat Completions | ✅ Vertex `generateContent` | Trivial swap through provider layer |
| Skills (tool calling) | ✅ OpenAI `tools` param | ✅ Gemini `function_declarations` | Schemas normalized in provider layer |
| Agentic (ADK) | ⚠️ Requires `LiteLlm` wrapper for ADK | ✅ Native ADK support | Gemini is the fast path for ADK |

> **Note on Agentic + OpenAI:** Google ADK is Gemini-native. When `LLM_PROVIDER=openai` **and** architecture is `agentic`, fall back to a LiteLLM-wrapped ADK model — e.g. `LiteLlm(model=f"openai/{os.getenv('OPENAI_MODEL', 'gpt-4o')}")` — so the agentic demo still works end-to-end. Document this branch clearly in `agentic_adk.py`.

---

## 6. Folder Structure

```
wealth-insights-demo/
├── README.md
├── SPEC.md                          ← this file
├── docker-compose.yml
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py                  ← FastAPI entrypoint
│   │   ├── config.py
│   │   ├── llm_provider.py          ← OpenAI / Gemini-Vertex abstraction
│   │   ├── models/
│   │   │   └── schemas.py           ← Pydantic request/response
│   │   ├── data/
│   │   │   ├── persona_first.json
│   │   │   ├── persona_middle.json
│   │   │   └── persona_affluent.json
│   │   ├── architectures/
│   │   │   ├── raw_prompt.py        ← Architecture 1
│   │   │   ├── skills.py            ← Architecture 2
│   │   │   └── agentic_adk.py       ← Architecture 3
│   │   ├── skills/
│   │   │   ├── __init__.py
│   │   │   ├── portfolio.py
│   │   │   ├── budgeting.py
│   │   │   └── market.py
│   │   ├── agents/
│   │   │   ├── root_agent.py
│   │   │   ├── planner_agent.py
│   │   │   ├── portfolio_agent.py   ← subagent
│   │   │   ├── budgeting_agent.py   ← subagent
│   │   │   └── education_agent.py   ← subagent
│   │   └── routes/
│   │       ├── insights.py          ← GET /insights/{persona}?arch=
│   │       └── chat.py              ← POST /chat
│   └── tests/
└── frontend/
    ├── package.json
    ├── tailwind.config.ts
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx                 ← Demo home
    │   └── compare/page.tsx         ← Side-by-side view
    ├── components/
    │   ├── PersonaSelector.tsx
    │   ├── ArchitectureToggle.tsx
    │   ├── InsightsCard.tsx
    │   ├── ChatPanel.tsx
    │   ├── PortfolioChart.tsx
    │   └── ArchitectureBadge.tsx
    └── lib/
        └── api.ts
```

---

## 7. Mock Data Schema

Each persona JSON follows the same shape so the frontend and skills stay generic.

```json
{
  "persona_id": "middle",
  "name": "Priya S.",
  "age": 42,
  "monthly_income": 7800,
  "monthly_expenses": 5200,
  "accounts": {
    "chequing": 3200,
    "savings": 42000,
    "credit_card_balance": 0
  },
  "debts": [],
  "investments": [
    {"type": "GIC", "value": 25000, "rate": 0.041, "maturity_date": "2026-08-15"}
  ],
  "portfolio_total": 25000,
  "risk_profile": "conservative",
  "goals": ["home_down_payment", "retirement"],
  "upcoming_events": [
    {"type": "gic_maturity", "days_out": 30, "amount": 25000}
  ]
}
```

Create three files: `persona_first.json`, `persona_middle.json`, `persona_affluent.json` with realistic values (Mass Affluent must have `portfolio_total > 1_000_000`).

---

## 8. Architecture 1 — Raw Prompting

**Goal:** Show the baseline. Everything is stuffed into the prompt; the LLM has no tools and no structured grounding.

```python
# backend/app/architectures/raw_prompt.py
from app.llm_provider import get_provider

SYSTEM_PROMPT = 'You are a wealth assistant. Persona: {persona}. Answer helpfully.'

async def raw_prompt_answer(persona: str, question: str) -> str:
    provider = get_provider()
    messages = [
        {'role': 'system', 'content': SYSTEM_PROMPT.format(persona=persona)},
        {'role': 'user', 'content': question},
    ]
    return provider.complete(messages)
```

**Failure modes to intentionally surface in the demo:**
- Hallucinates portfolio numbers when asked *"Give me the total in my portfolio."*
- Gives generic savings advice unrelated to actual income.
- Can't take action (no tools).
- No memory across turns beyond raw context window.

---

## 9. Architecture 2 — Raw Prompting with Skills

**Goal:** Introduce **structured tools/skills** the LLM can call. Fixes grounding, still single-shot.

```python
# backend/app/skills/portfolio.py
def get_portfolio_total(persona_id: str) -> dict:
    data = load_persona(persona_id)
    return {"portfolio_total": data["portfolio_total"], "currency": "CAD"}
```

```json
{
  "name": "get_portfolio_total",
  "description": "Returns the user's current total portfolio value.",
  "parameters": {
    "type": "object",
    "properties": {"persona_id": {"type": "string"}},
    "required": ["persona_id"]
  }
}
```

```python
# backend/app/architectures/skills.py
SKILLS = [get_portfolio_total_schema, get_budget_recommendation_schema, get_market_snapshot_schema]

async def skills_answer(persona_id: str, question: str) -> str:
    # 1) Ask model which skill (if any) to call — via provider layer (OpenAI tools or Gemini function_declarations)
    # 2) Execute skill
    # 3) Feed result back to model to finalize answer
    ...
```

**What improves:**
- Portfolio total is now **grounded** in real data.
- Budget recommendations use actual income/expenses.

**What still fails:**
- Only one skill call per turn (no chaining).
- No planning — model must know exactly which skill to use.
- No proactive insights; no memory.
- Complex questions ("Should I pay debt or invest?") still get shallow answers.

---

## 10. Architecture 3 — Agentic Application (Google ADK)

**Goal:** Full agentic experience — planner, subagents, tool calling, memory, proactive insights.

### Agent Topology

```
                ┌──────────────────┐
                │   Root Agent      │
                │  (Orchestrator)   │
                └────────┬──────────┘
                         │
       ┌─────────────────┼──────────────────┐
       ▼                 ▼                  ▼
┌────────────┐  ┌────────────────┐  ┌────────────────┐
│ Portfolio  │  │   Budgeting    │  │   Education    │
│   Agent    │  │     Agent      │  │     Agent      │
└─────┬──────┘  └──────┬─────────┘  └───────┬────────┘
      │                │                    │
   Tools:           Tools:               Tools:
   get_portfolio    get_income          explain_concept
   get_allocation   get_expenses        get_market_news
   get_performance  suggest_savings     get_debt_strategy
```

### ADK Skeleton (provider-aware)

```python
# backend/app/agents/root_agent.py
import os
from google.adk.agents import LlmAgent
from .portfolio_agent import portfolio_agent
from .budgeting_agent import budgeting_agent
from .education_agent import education_agent

def _resolve_model():
    provider = os.getenv('LLM_PROVIDER', 'gemini').lower()
    if provider == 'gemini':
        # ADK routes through Vertex AI when GOOGLE_GENAI_USE_VERTEXAI=true
        return os.getenv('GEMINI_MODEL', 'gemini-1.5-pro')
    if provider == 'openai':
        # OpenAI path via LiteLLM wrapper (ADK is Gemini-native otherwise)
        from google.adk.models.lite_llm import LiteLlm
        return LiteLlm(model=f"openai/{os.getenv('OPENAI_MODEL', 'gpt-4o')}")
    raise ValueError(f'Unknown LLM_PROVIDER: {provider}')

root_agent = LlmAgent(
    name='wealth_root',
    model=_resolve_model(),
    instruction=(
        'You are the orchestrator for a wealth assistant. '
        'Route questions to the correct subagent. '
        'Always ground numbers in tool outputs. '
        'Tailor tone to the active persona (first/middle/affluent).'
    ),
    sub_agents=[portfolio_agent, budgeting_agent, education_agent],
)
```

```python
# backend/app/agents/portfolio_agent.py
from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool
from app.skills.portfolio import get_portfolio_total, get_allocation, get_performance

portfolio_agent = LlmAgent(
    name='portfolio_agent',
    model='gemini-1.5-flash',  # or LiteLlm(...) via same _resolve_model() helper
    instruction='Handle portfolio value, allocation, and performance queries.',
    tools=[
        FunctionTool(get_portfolio_total),
        FunctionTool(get_allocation),
        FunctionTool(get_performance),
    ],
)
```

### Proactive Initial Insights

On persona selection, call `/insights/{persona}?arch=agentic`. The root agent runs a **planning pass** that:
1. Reads the persona profile.
2. Inspects `upcoming_events`.
3. Delegates to relevant subagents to generate 2–3 personalized insight cards.
4. Returns structured JSON: `[{title, body, cta}]`.

### What only Agentic can do
- Chain tool calls: check debt → check savings → recommend split.
- Handle ambiguous questions via a planner.
- Maintain **session memory** across the follow-up conversation.
- Escalate to a "human advisor" tool (mocked) for Mass Affluent.

---

## 11. UI / UX Design

### Home Page (`/`)
- **Left sidebar:** Persona selector (3 cards with icon + name + one-liner).
- **Top bar:** Architecture toggle (segmented control: `Raw` · `Skills` · `Agentic`) **and** a small provider badge showing the active LLM (`OpenAI` or `Gemini/Vertex`).
- **Main area:**
  - **Initial Insights Cards** (top): 2–3 personalized cards.
  - **Chat Panel** (below): follow-up questions.
- **Architecture Badge** on every AI message showing which architecture generated it.

### Compare Page (`/compare`)
- Three chat panels side-by-side (one per architecture).
- Single input box at the bottom → question is sent to all three simultaneously.
- Great for exec demo: type *"Give me my portfolio total"* → watch Raw hallucinate, Skills return a bare number, Agentic return a contextualized answer with a chart.

### Visual polish
- Use shadcn `Card`, `Tabs`, `Badge`, `Button`.
- Persona colors: First = teal, Middle = indigo, Affluent = gold.
- Include a small **PortfolioChart** (Recharts donut) for Affluent.
- Subtle animation on message stream (token-by-token).

---

## 12. API Contract

### `GET /insights/{persona_id}?arch=raw|skills|agentic`
Returns:
```json
{
  "architecture": "agentic",
  "provider": "gemini",
  "insights": [
    {"title": "GIC maturing in 30 days", "body": "...", "cta": "Explore options"},
    {"title": "Cash drag detected",       "body": "...", "cta": "See scenarios"}
  ],
  "timing_ms": 1420
}
```

### `POST /chat`
```json
{
  "persona_id": "middle",
  "architecture": "agentic",
  "session_id": "abc123",
  "message": "How much should I save from my monthly income?"
}
```
Response:
```json
{
  "reply": "...",
  "provider": "openai",
  "tool_calls": [{"name": "get_income", "result": {}}],
  "architecture": "agentic",
  "timing_ms": 980
}
```

Expose `tool_calls` **and `provider`** so the UI can render a small **"trace"** panel and a provider badge — killer visuals for execs.

---

## 13. Phased Implementation Plan

| Phase | Deliverable | Est. Time |
|---|---|---|
| **1. Scaffolding** | Repo, FastAPI + Next.js hello world, mock data JSONs, persona selector UI, `llm_provider.py` skeleton | 0.5 day |
| **2. Raw Prompting** | Architecture 1 endpoint (OpenAI + Gemini/Vertex paths) + basic chat UI | 0.5 day |
| **3. Skills** | Define 5–6 skills, implement Architecture 2 for both providers, tool-call trace UI | 1 day |
| **4. Agentic (ADK)** | Root + 3 subagents, session memory, proactive insights, LiteLLM fallback for OpenAI | 1.5 days |
| **5. Compare Page** | Side-by-side triple chat, unified input, provider badge | 0.5 day |
| **6. Polish + Demo Script** | Charts, animations, README, deck notes | 0.5 day |

**Total:** ~4.5 focused days.

---

## 14. Executive Demo Script

**Opening (30 sec):** *"Today I'll show the same three questions asked of three different AI architectures — running on either OpenAI or Gemini on GCP Agent Platform — and why the architecture matters more than the vendor."*

**Beat 1 — Raw Prompting fails safely-critically.**
- Select **Mass Affluent**, architecture = **Raw**.
- Ask: *"Give me the total in my portfolio."*
- Model hallucinates a number.
- Talking point: *"In a regulated business, this is a P1 incident waiting to happen — regardless of whether it's OpenAI or Gemini."*

**Beat 2 — Skills ground the answer.**
- Switch to **Skills**. Ask same question.
- Correct number appears — but the answer is dry.
- Ask a follow-up: *"Should I be worried about volatility?"*
- Answer is generic; no memory of previous turn.
- Talking point: *"Grounded, but not intelligent."*

**Beat 3 — Agentic delivers the experience.**
- Switch to **Agentic**. Same questions.
- Answer is grounded, contextualized to the persona, references the previous turn, and shows a **tool trace** (portfolio → allocation → market snapshot).
- Talking point: *"This is what 'shift from tracking money to planning life' actually looks like."*

**Beat 4 — Provider swap live on stage.**
- Flip `LLM_PROVIDER` from `gemini` to `openai` (or vice versa) via a settings toggle.
- Same personas, same architectures, same story — talking point: *"Our architecture, not our vendor, is what makes this trustworthy."*

**Closing:** *"Raw prompting is a great prototype. Skills are a great API. Agents are the product."*

---

## 15. Evaluation Matrix

| Capability | Raw Prompt | Skills | Agentic |
|---|:---:|:---:|:---:|
| Grounded numbers | ❌ | ✅ | ✅ |
| Personalized to profile | ⚠️ | ✅ | ✅ |
| Multi-step reasoning | ❌ | ⚠️ | ✅ |
| Session memory | ❌ | ❌ | ✅ |
| Proactive insights | ❌ | ⚠️ | ✅ |
| Tool trace / auditability | ❌ | ✅ | ✅ |
| Safe for regulated use | ❌ | ⚠️ | ✅ |
| Provider-portable (OpenAI ↔ Gemini) | ✅ | ✅ | ✅ (via LiteLLM for OpenAI) |
| Effort to build | Low | Medium | High |

---

## 16. Setup & Run

### Common prereqs
- Python 3.11, Node 20, `pnpm`, `uv`
- `gcloud` CLI (only for Gemini/Vertex path)

### Option A — Run on **OpenAI** (API key)

```bash
git clone <repo> && cd wealth-insights-demo

# .env for backend
cat > backend/.env <<EOF
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
# OPENAI_BASE_URL=https://your-azure-or-proxy/v1   # optional
EOF

cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000
# In a new terminal:
cd frontend && pnpm install && pnpm dev   # http://localhost:3000
```

### Option B — Run on **Gemini via Vertex AI (Agent Platform) with SA Impersonation**

```bash
# One-time GCP setup
gcloud auth application-default login
gcloud iam service-accounts add-iam-policy-binding \
  sa-agent@my-gcp-project.iam.gserviceaccount.com \
  --member='user:you@example.com' \
  --role='roles/iam.serviceAccountTokenCreator'

# .env for backend
cat > backend/.env <<EOF
LLM_PROVIDER=gemini
GOOGLE_CLOUD_PROJECT=my-gcp-project
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=true
GCP_IMPERSONATE_SERVICE_ACCOUNT=sa-agent@my-gcp-project.iam.gserviceaccount.com
GEMINI_MODEL=gemini-1.5-pro
EOF

cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000
cd frontend && pnpm install && pnpm dev
```

### Docker Compose (either provider)
```bash
docker compose --env-file backend/.env up --build
```

---

## 17. Appendix — Prompts & Tool Definitions

### System prompt (Agentic root)
```
You are the orchestrator for a wealth assistant serving a Canadian bank.
The active persona is {persona}. Always:
1. Ground every number in a tool call.
2. Never invent balances, rates, or performance figures.
3. Route portfolio questions to portfolio_agent, budget questions to budgeting_agent, education to education_agent.
4. For Mass Affluent, offer a warm handoff to an advisor when volatility or complex planning is discussed.
5. Match tone to persona: encouraging (First), reassuring (Middle), premium/concise (Affluent).
```

### Skills to implement (minimum)
| Skill | Input | Output |
|---|---|---|
| `get_portfolio_total` | persona_id | total, currency |
| `get_allocation` | persona_id | breakdown by asset class |
| `get_performance` | persona_id, window | pct change, benchmark |
| `get_income_expenses` | persona_id | monthly income, expenses, surplus |
| `suggest_savings_rate` | persona_id | recommended % and $ |
| `get_debt_strategy` | persona_id | avalanche vs snowball plan |
| `get_market_snapshot` | — | headline indices, one-line context |
| `book_advisor_meeting` | persona_id, topic | confirmation stub |

### Test cases (must pass)
1. Raw returns *some* answer to all sample questions (baseline) on both providers.
2. Skills returns the correct portfolio total for each persona on both providers.
3. Agentic, when asked *"Should I pay down debt or invest?"* as **First**, calls at least `get_income_expenses` and `get_debt_strategy` before answering.
4. Agentic remembers persona choice across a 3-turn conversation.
5. Swapping `LLM_PROVIDER` requires **no code changes** — only an env restart.

---

## 18. Definition of Done

- [ ] All 3 architectures reachable from the UI.
- [ ] Persona selector changes context in all 3.
- [ ] Compare page renders 3 responses to one input.
- [ ] Tool-call trace visible for Skills + Agentic.
- [ ] Portfolio chart renders for Mass Affluent.
- [ ] README has one-command run instructions **for both providers**.
- [ ] Demo script rehearsed in under 8 minutes.
- [ ] App runs on **OpenAI** when `LLM_PROVIDER=openai` with `OPENAI_API_KEY`.
- [ ] App runs on **Gemini (Vertex AI)** via **GCP service account impersonation** when `LLM_PROVIDER=gemini`.
- [ ] Provider badge visible in UI reflects the active provider.
- [ ] No long-lived GCP JSON keys committed anywhere.

---

*End of spec. Hand this file to Claude Code with the instruction: "Implement this repo end-to-end. Support both LLM providers (OpenAI and Gemini on Vertex AI with SA impersonation) as specified in Section 5. Ask me only if a decision blocks progress."*