# 8 · Demo Script and FAQ

## Before the room

```bash
git pull && npm i
cp .env.example .env            # first time only; set LLM_MODE=gemini + GOOGLE_CLOUD_PROJECT if you want the live LLM
gcloud auth application-default login --impersonate-service-account=<sa>@<project>.iam.gserviceaccount.com   # Gemini only
make dev                        # or: npm run dev (offline, one process)
make calibrate                  # optional: confirm green/amber/red coverage
```

Open <http://localhost:5173>. Check the page header says the summary mode you intend
(*templated (offline)* / *Gemini on Vertex AI (…)* / *OpenAI (…)*). Widen the window so both columns show.

**Fallback plan:** if the network or the LLM misbehaves, the demo keeps working — the gadget will say
*“Gemini unavailable — showing the templated summary”*. You can also set `LLM_MODE=templated` and restart.

## A 10-minute walkthrough

| Min | Do | Say |
|---|---|---|
| 0–1 | Show segment **11 · Mid-career mortgage-heavy accumulator** (Borderline, 76 %) | “This is the real *My Future* screen with one new layer: an AI reading of the forecast.” |
| 1–3 | Expand the AI card; read the headline and narrative; open **Why?** | “Every number here is a simulation output — the *Why?* list is literally the grounding.” |
| 3–4 | Tap **Save more** | Gadget: *Simulated 5,000 futures → Writing your summary…* “The chart, the KPI and the copy all re-derive; the summary explains the delta: 76 → 88 %.” |
| 4–5 | Switch to **14 · Over-spender at risk** (red), then **12 · Dual-income, on track** (green) | “Tone follows the band — direct and constructive when at risk, reassuring when on track. Same guardrails every time.” |
| 5–7 | Choose **Custom**, change *Monthly expenses*, press **Run outlook** | “Edits are deliberate: you submit, you see exactly what runs and when the AI is done.” |
| 7–8 | Open **See more** | “The outcome histogram and the goal gauge come from the same 5,000 paths — nothing is drawn by hand.” |
| 8–9 | Show `.env` → `LLM_MODE` | “Vendor is a config switch: Gemini on our GCP with impersonated credentials, or OpenAI, or none.” |
| 9–10 | Run `make test` in a terminal | “24 tests; this one fails if the copy ever contains a number the simulation didn’t produce.” |

## Talking points

- **Trust:** the LLM rewrites a draft that is already correct; a runtime check rejects any reply that
  introduces a number not in the simulation. It cannot make a figure up.
- **Fit:** inputs, fields and chart series are the ones in our data inventory; the phone screen is the POC’s
  own “My Future” tab. This is not a parallel product.
- **Compliance:** today’s dollars, taxes not modelled, general information not advice — on screen and in the prompt.
- **Vendor-neutral:** Gemini on Vertex AI via the credentials our environment already has; OpenAI for comparison;
  offline mode for resilience.
- **Path to production:** three documented seams — segmentation model, projection engine + Wealth Studio
  assumptions, summary service — and an output contract the app can integrate against now.

## FAQ

**Is the simulation real or canned?**
Real. 5,000 seeded random paths per run, year by year; change any input and it re-computes in ~100 ms.
Set the seed under *Dev controls* to prove reproducibility.

**Does the AI decide what to tell the client?**
No. The templated generator decides *what* (facts, lever, band tone); the LLM only improves *how it reads*.
Turn the LLM off and the facts and structure are unchanged.

**Can it hallucinate a number?**
Every LLM reply is scanned; a single number that is not a registered simulation fact rejects the whole reply.
The same check is a unit test on the templated generator.

**Why 90 %?** Product decision from the data inventory: Good ≥ 90, Borderline 75–89, At Risk < 75 (G8).

**Why does it say “about” and “around”?** Deliberate — qualitative framing over false precision, per the
projection-engine guardrails.

**What data does the LLM see?** About 30 numbers plus the band and segment label — no PII, no transactions.

**What about taxes / RRSP / TFSA?** Not modelled, exactly like the MVP engine; the copy says so and never
implies tax treatment. It is a documented production decision (`D14/D17`).

**Which model is it using?** Whatever `.env` says — the page header and the card footer state it.
Gemini 2.5/3.x Flash with thinking minimised, or GPT-5-nano with minimal reasoning, both ~1–3 s.

**What happens if Vertex/OpenAI is down?** The templated summary is shown, the gadget says why, and a
circuit breaker stops retrying for 10 minutes.

**Is anything client-specific stored?** No. The demo holds state in memory only; nothing is written anywhere.

**How much of this survives to production?** The engine, the summary generator, the grounding check and the
output contract. The segment file and the UI mock are stand-ins.

**How long did it take / how big is it?** ~1.8k lines of TypeScript, 24 tests, four runtime dependencies
(React, React-DOM, Recharts, google-auth-library).
