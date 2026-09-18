# Projection Engine — Assumptions, Rules & Disclaimers (MVP scope)

> **Source:** `FP POC (6).pdf` disclaimers/assumptions screen. These define the **boundaries of what the forecast (UC2) may claim** and what the AI narrative (UC1/UC2) must NOT over-promise. Treat as guardrails for AI output.

## Projection methodology

- Growth estimates come from the **Institute of Financial Planning & FP Canada Standards Council — 2025 Projection Assumption Guidelines**. Updated periodically.
- Default median annual return **3%** maps to a **Balanced portfolio** (per data inventory).
- Bands are percentile-based (p10/p25/median/p75/p90) — a Monte-Carlo-style fan.
- Assumptions are **reviewed and updated** to reflect current economic conditions.

## What the MVP engine assumes (explicit simplifications)

**Money habits**

- No new money in/out beyond already-scheduled ASP (Automatic Savings Program). No scheduled contributions ⇒ assumes none added.
- Same debt payments continue; no extra payments or new borrowing.

**Investments**

- GICs auto-reinvest at maturity at the same rate.
- Investment mix stays constant (no reallocation between funds).

**Taxes** ⚠️

- Projections **do NOT account for taxes.**
- **TFSAs, RRSPs and other registered accounts are treated the same as regular accounts** — their tax advantages are NOT modelled in MVP.
- No check of TFSA/RRSP contribution room; over-contribution is the client's responsibility.

**Inflation**

- All amounts shown in **"today's dollars"** (real). Purchasing power will be lower than nominal figures suggest.

**FX**

- US-dollar accounts converted at Tangerine's rate; **rate assumed constant** for 10 years.

**Scheduled contributions (ASP)**

- Open-ended ASP assumed to continue at same amount/frequency for the full 10-year horizon.
- Savings rate used is the rate at calculation time (can change).
- Only **CAD-account** ASPs are included; USD-account contributions excluded.

**Unexpected events**

- Assumes no market crash / recession / major life change (job loss, marriage, divorce, kids, inheritance).

**Information accuracy**

- Assumes user-entered external assets/debts are correct and current; if wrong/outdated, projections are misleading. Client must keep them up to date.

## Horizon note

- The **Net Worth "hypothetical"** projection shown on the snapshot tab is a **10-year** horizon; the **"My Future"** forecast runs to **life expectancy** (e.g. age 90). Don't conflate the two horizons in AI copy.

## Compliance guardrails for AI output (UC1–UC3)

These MUST be respected by any generated narrative or suggestion:

- Output is **general information, not personalized investment/financial/legal/tax/accounting advice.** Recommend a qualified professional for advice.
- Do not imply tax treatment the engine doesn't model (registered accounts, etc.).
- Reflect **today's-dollars / inflation** caveat when citing future values.
- External values are **unverified**; label them as such.
- Official records are account statements; if AI figures differ, statements win.
- Mutual fund standard disclosure applies (commissions, MER, not CDIC-insured, values change, past performance ≠ future).

## Practical takeaway for the AI features

The engine is deliberately simple in MVP. AI narratives should:

1. **Explain**, not extend, the engine (don't invent tax/registered-account logic).
2. **Surface the caveats in plain language** (a strength — builds the trust the personas need).
3. Use the **qualitative bands** (Good/Borderline/At Risk; % money lasts) rather than implying false precision on dollar amounts.
