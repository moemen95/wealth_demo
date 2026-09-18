# Tangerine Wealth — AI Use Cases Documentation

Documentation and design docs for the **New Tangerine Wealth** AI features, transcribed from source screenshots into Markdown. The three target AI use cases sit inside the Phase 2 / MVP2 "Financial Planning" and "Portfolio insights" capabilities:

- **UC1 — AI Summary** of the Future Outlook (plain-language reading of the Monte Carlo forecast)
- **UC2 — AI Future Charting** (interactive chart + scenario controls; shares the UC1 engine)
- **UC3 — Spending** insights/nudges

## Structure

```
docs/
├── context/       Background: product, personas, strategy, POC design, data, engine rules
├── deliverables/  The data product, the demo build-prompt, and open questions
├── use-cases/     Per-use-case specs (UC1, UC2)
└── design/        "My Future" screen reference + captured screenshots
```

## Contents

### context/ — background & data foundations

| Doc | What it covers |
|---|---|
| [00-product-overview.md](context/00-product-overview.md) | Where Wealth is going; roadmap phases; tiers; client profitability |
| [01-personas.md](context/01-personas.md) | Elena / Elijah / Esme personas and their AI implications |
| [02-tiered-model-strategy.md](context/02-tiered-model-strategy.md) | Tier architecture, where AI is promised, competitor benchmarking, fees |
| [03-fp-poc-design.md](context/03-fp-poc-design.md) | Existing FP POC screens & flows ("My Net Worth" / "My Future") |
| [04-data-inventory.md](context/04-data-inventory.md) | Inputs (`I#`), internal data (`D#`), chart series (`G#`), availability |
| [05-projection-engine-assumptions.md](context/05-projection-engine-assumptions.md) | MVP engine assumptions, disclaimers, AI compliance guardrails |
| [06-edw-schema-reference.md](context/06-edw-schema-reference.md) | EDW/BigQuery schema behind the bindings — ⚠️ *placeholder (not in screenshots)* |

### deliverables/

| Doc | What it covers |
|---|---|
| [data-product-persona-fields.md](deliverables/data-product-persona-fields.md) | **Deliverable A** — full field catalog, EDW bindings, hand-off checklist |
| [demo-prompt-uc1-future-simulation.md](deliverables/demo-prompt-uc1-future-simulation.md) | Runnable mock-demo build prompt (Monte Carlo + AI summary) |
| [uc1-open-questions.md](deliverables/uc1-open-questions.md) | ⚠️ *placeholder (not in screenshots)* |
| [questions-for-wealth-team.md](deliverables/questions-for-wealth-team.md) | ⚠️ *placeholder (not in screenshots)* |
| [design-surfacing-ideas.md](deliverables/design-surfacing-ideas.md) | ⚠️ *placeholder (not in screenshots)* |

### use-cases/

| Doc | What it covers |
|---|---|
| [uc1-ai-financial-summary.md](use-cases/uc1-ai-financial-summary.md) | UC1 spec — pipeline, data contract, output shape, guardrails |
| [uc2-ai-future-charting.md](use-cases/uc2-ai-future-charting.md) | ⚠️ *placeholder (not in screenshots)* |

### design/

| Doc | What it covers |
|---|---|
| [my-future-screen-reference.md](design/my-future-screen-reference.md) | Transcription + photos of the live "My Future" mobile screen |

## Note on sources

These docs were reconstructed from 28 photographs of an editor. Cross-references between files (`../context/…`, `../deliverables/…`) are preserved so the set navigates as one repo. `$`-amounts that the editor mis-rendered as math (e.g. `$25K–$250K`) have been restored to plain text.

Five documents are **referenced by others but were not in the screenshot set**; they exist here as clearly-marked placeholders. Supply their screenshots to have them transcribed too.
