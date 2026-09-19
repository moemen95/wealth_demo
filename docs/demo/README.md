# UC1 “Future Outlook” Demo — Technical Documentation

This folder documents the runnable demo of **UC1 — AI Summary of the Future Outlook**: a real
Monte Carlo retirement simulation for a chosen client, explained by an AI-written, fact-grounded
summary, rendered inside a phone-frame mock of the Tangerine **“My Future”** tab.

It is written for a technical audience preparing to present the demo to leadership: what it does,
how it is built, what is real vs. mocked, what guarantees it makes, and how it graduates to
production.

| # | Document | Read it for |
|---|---|---|
| 0 | [Executive summary](00-executive-summary.md) | The two-minute version: what it proves, what it doesn’t, headline numbers |
| 1 | [Architecture](01-architecture.md) | Components, processes, data flow, technology choices |
| 2 | [Workflow](02-workflow.md) | What happens from a click to an updated screen; the status gadget |
| 3 | [Simulation engine](03-simulation-engine.md) | The Monte Carlo: inputs, math, outputs, bands, scenario toggles, reproducibility |
| 4 | [AI summary & LLM](04-ai-summary-and-llm.md) | Templated generator, grounding guarantee, LLM rewrite, providers, failure handling |
| 5 | [Parameters & configuration](05-parameters-and-configuration.md) | Every client field, engine constant, environment variable and Make target |
| 6 | [Quality, security & compliance](06-quality-security-compliance.md) | Tests, credential handling, guardrails, what leadership will ask |
| 7 | [Path to production](07-path-to-production.md) | Swap-in points, gaps vs. the data product, roadmap |
| 8 | [Demo script & FAQ](08-demo-script-and-faq.md) | A 10-minute walkthrough and answers to likely questions |

## At a glance

- **Stack:** React 18 + Vite 5 + TypeScript, Recharts; a ~1.8k-line codebase with no backend
  dependency other than an optional Node LLM proxy. Runs with `npm i && npm run dev`, fully offline by default.
- **Simulation:** 5,000 seeded Monte Carlo paths per run, year by year in today’s dollars, P10–P90 bands,
  “chance money lasts” KPI with Good ≥ 90 / Borderline 75–89 / At Risk < 75 bands.
- **AI summary:** a deterministic generator whose every number is a registered simulation fact, optionally
  rewritten by **Gemini on Vertex AI** (ADC / impersonation, no key) or **OpenAI**; every LLM reply is
  re-verified against the facts before it is shown.
- **Data:** 30 synthetic client segments across the three personas (8 on-track / 10 borderline / 12 at-risk),
  standing in for the future segmentation model; a **Custom** client can be edited field by field.
- **Quality gates:** 24 automated tests, including a grounding test that fails if the copy ever contains a
  number that is not in the simulation output.

## Source docs this demo implements

The demo is the concrete implementation of the specs in the sibling folders:
[`../use-cases/uc1-ai-financial-summary.md`](../use-cases/uc1-ai-financial-summary.md) (the use case),
[`../deliverables/demo-prompt-uc1-future-simulation.md`](../deliverables/demo-prompt-uc1-future-simulation.md)
(the build spec), [`../context/04-data-inventory.md`](../context/04-data-inventory.md) (fields `I#`/`D#`/`G#`)
and [`../context/05-projection-engine-assumptions.md`](../context/05-projection-engine-assumptions.md)
(engine guardrails).
