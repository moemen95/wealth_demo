# 0 · Executive Summary

## What the demo is

A working, self-contained prototype of the **AI “Future Outlook” summary** for the Tangerine Wealth
“My Future” tab. Pick a client (or build a custom one), press **Run outlook**, and the demo:

1. runs a genuine **Monte Carlo simulation** of that client’s net worth from today to life expectancy
   (5,000 paths), producing the fan chart, the *chance money lasts* KPI and its Good / Borderline / At Risk band;
2. writes a **plain-language AI summary** of that outlook — headline, narrative, highlight chips, a
   “Why?” list of the driving numbers, and what each quick scenario would change;
3. renders all of it inside a phone-frame mock of the real screen, with the app’s scenario toggles
   (*Save more · Retire earlier · Live longer · Market downturn*) live and re-simulating on tap.

## What it proves

| Claim | How the demo backs it |
|---|---|
| The AI never invents a number | Every figure in the copy must be a registered simulation fact; an automated test fails otherwise, and LLM output is re-checked at runtime before display |
| It respects the engine’s compliance boundaries | Copy always carries *today’s dollars · taxes not modelled · general information, not advice*; the LLM is told the same guardrails |
| It works with either LLM vendor, or none | Templated summary offline; optional rewrite by **Gemini on Vertex AI** (Google credentials already in the environment, no API key) or OpenAI |
| It fits the existing product | Built on the POC’s own inputs (`I#`), data fields (`D#`) and chart series (`G#`) from the data inventory; the phone screen mirrors the real “My Future” tab |
| It is honest about what is mocked | The 30 segments stand in for the ML segmentation model; the local engine stands in for Wealth Studio capital-market assumptions — both are documented swap-in points |

## Headline numbers

- **5,000** simulated futures per run, seeded and reproducible; a full run (baseline + 4 scenario readings + 2 levers) completes in ~100 ms in the browser.
- **30** client segments, 10 per persona (Elena / Elijah / Esme), calibrated to **8 green / 10 amber / 12 red** so the whole badge range is visible.
- **24** automated tests; type-checked; runs under Node ≥ 22.18 with one command.
- LLM rewrite round-trip **~1.6 s** with GPT-5-nano (reasoning minimised); comparable with Gemini 2.5/3.x Flash with thinking minimised.

## What it is not (yet)

- Not connected to client data — inputs come from the segment file or the form.
- Not a tax-aware or product-aware planner — it deliberately mirrors the MVP engine’s simplifications (no taxes, constant mix, flat real contributions).
- Not a conversational assistant — UC1 is a non-conversational summary by design.
- The LLM is a *rewriter* of an already-correct draft, not the source of truth; removing it changes tone, not facts.

## The one-sentence pitch

*“Same simulation, same numbers, same guardrails — the AI just explains them in the client’s language, and we can prove it never makes a figure up.”*
