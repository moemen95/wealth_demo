# Financial Planning POC — Existing Design & Flows

> **Source:** `FP POC*.pdf` (7 Figma prototype exports + dev-annotated specs). These show what **already exists** in the design so the AI use cases can slot into it rather than reinvent screens. The POC has **two anchor surfaces** inside a **"Plan"** tab (bottom nav: Home · Transfer · Invest · **Plan** · More), with two sub-tabs: **"My Net Worth"** and **"My Future"**.

## A. "My Net Worth" tab (the snapshot — home of UC1)

Header: **"Welcome to Wealth" / "Every little step counts"** — "Build your financial picture by tracking your net worth."

Contents:

- **Current net worth** (e.g. `$1,665,319`) as of a date, with a **history chart** (age/time X-axis, ~20→40) and a **hypothetical 10-year net worth** value.
- **Current assets** and **current liabilities** totals.
- Quick actions: **Add asset · Add liability · Transfer money · About net worth**.
- **Assets** grouped into **Tangerine assets** (Chequing, Savings, Dividend Portfolio, Money Market Portfolio…) and **External assets** (e.g. CIBC Account), each with balance, % change, and "as of" date.
- **Liabilities** grouped into **Tangerine liabilities** (World Mastercard, Mortgage) and **External liabilities** (e.g. "My boat").
- **Revisit reminders** for external items ("1 revisit reminder").
- Disclaimer: external items are unverified; all values CAD.

**Tap-a-point-on-chart** interaction reveals net worth / total assets / total liabilities at that time (per the data inventory).

## B. "My Future" tab (the forecast — home of UC2)

Header: **"See what your future could look like" / "Make choices for tomorrow"**.

Contents:

- **Retirement net worth** headline (e.g. `$1,473,963`).
- **"Chance money lasts"** KPI (e.g. `93%`) with a qualitative badge (**Good / Solid / Borderline / At Risk**).
- A **fan/band forecast chart**: age X-axis (e.g. 40→90), median line + shaded percentile bands, a **retirement marker**, and hidden $ Y-scale.
- **Hypothetical retirement at 65** and **legacy at 90** annotations.
- **Explore Scenarios / Explore what's possible** CTA.

### Scenario controls (the "engine" inputs)

- **Quick scenarios (toggles):** *Save more* (+$500/mo), *Retire earlier* (−5y), *Live longer* (+5y). (A *Market downturn* stress toggle appears in some builds.)
- **Personal sliders:** Retirement age, Life expectancy.
- **Financial sliders:** Annual income, Monthly contributions, Monthly expenses.
- **Market assumptions:** Market outlook (Worst/Expected/Best), Inflation rate, Return rate. **Apply Changes** re-runs the projection.

## C. Onboarding / setup flow

1. **Stories intro** ("See how you've been doing" → "See what your future could look like").
2. **Financial Details** — *"Start with where you are today"*: pre-filled **Annual income, Monthly contributions, Monthly expenses** (estimated from Canadian averages / card spend), user can edit.
3. **Assets and Liabilities** — *"Complete your financial picture"*: add external assets/liabilities. **Add external asset** modal fields: Asset type, Asset name, Estimated value, **Annualized rate of return (optional)**, **Effective date**, Revisit date (optional).
4. **"You're all set!"** → guided **tour**.

## D. Design-system notes (from dev annotations)

- Componentized **"Engine"** building blocks (step tracker, title, description, image, button); typography tokens (`$large-title` 24/29, `$text` 17/22); color tokens (`$content-strong/weak/medium`, `$interactive/*`); corner radius `$large` (16); 44×44 touch targets; copy lives in a shared **copy deck**.
- Long **disclaimers/assumptions** screen exists (see [05-projection-engine-assumptions.md](05-projection-engine-assumptions.md)).

## E. What is NOT in the POC yet (the opportunity)

The current POC covers **net-worth tracking** and **scenario forecasting** UI, but there is **no AI-generated summary, no AI narrative on the future chart, and no spending-habit suggestions**. UC1–UC3 are net-new agentic layers that surface on top of these existing surfaces (see [../deliverables/design-surfacing-ideas.md](../deliverables/design-surfacing-ideas.md)).
