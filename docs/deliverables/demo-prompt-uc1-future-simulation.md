# Demo Prompt — UC1 Future Simulation (runnable mock)

> This document is a self-contained build prompt for a runnable mock demo. Paste everything under **PROMPT** into a coding session.

## PROMPT (paste everything below)

Build a mock, runnable web demo of an AI **"Future Outlook"** summary for a Tangerine Wealth mobile app. It must run locally with one command and need no external services or API keys by default.

### Product goal

Show, for a chosen client, a **Monte Carlo simulation** of their financial future (retirement net-worth projection) and an **AI-generated summary** that explains it in plain language, with supporting, interactive visualizations. Non-conversational.

### Layout — two columns

- **Left column — "Client / Persona"**
  - A selector to choose one of **30 predefined client segments** (personas) **plus a "Custom" option**.
  - Show the selected client's data as **editable fields**: age, retirement age, life expectancy, net worth, total assets, total liabilities, debt (of which), annual income, monthly contributions, monthly expenses, asset mix (% equity / fixed income / cash), expected return %, return volatility %, inflation %, risk profile (Conservative/Balanced/Growth/Aggressive).
  - For the 30 segments these are prefilled from the segment; for **Custom** the user edits everything. Editing any field (including on a predefined segment) re-runs the simulation + summary live.
- **Right column — "Mobile app: My Future tab"**
  - Render a **phone-frame mock** styled like the provided Tangerine "My Future" screen (status bar "9:41", tab title "My Future", bottom nav Home · Transfer · Invest · Plan · More with "Plan" active).
  - Inside it show, top to bottom:
    - **a. KPIs:** "Retirement net worth" (median at retirement), and **"Chance money lasts"** as a big % with a qualitative badge — Good ≥90 / Borderline 75–89 / At Risk <75 (green/amber/red).
    - **b. Fan chart:** age on X (current age → life expectancy), a median (P50) line, an inner band (P25–P75), an outer band (P10–P90), a vertical **retirement marker**, and accumulation vs decumulation shading. Tapping/hovering a point shows the P10/P50/P90 values at that age. Y-axis $ scale can be hidden/abbreviated.
    - **c. AI Summary card** — an **expandable** component:
      - Collapsed: a one-line headline (e.g. "You're on track — ~93% chance your money lasts to 90.") + the badge.
      - Expanded: 2–4 sentence narrative, 2–3 **highlight chips** (chance money lasts, projected NW at 65, biggest lever), and a **"Why?"** toggle that lists the driving numbers (grounding).
    - **d. Interactive scenario toggles** (like the real app): Save more (+$500/mo), Retire earlier (−5y), Live longer (+5y), plus a **Market downturn** stress toggle. Toggling re-runs the sim and the summary updates to explain the delta ("Adding $500/mo raises the chance to ~96%").
    - **e. Extra visualization** (expandable "See more"): an **outcome distribution** histogram of ending net worth (from the simulated paths) and a **goal gauge** (target 90% vs current %).

### Monte Carlo engine (mock but real math)

Implement a real, simple Monte Carlo — do **not** hardcode the chart:

- Inputs: `current_age`, `retirement_age`, `end_age` (life expectancy), `starting_net_worth`, `annual_contribution` (= monthly_contribution×12, applied during accumulation), `annual_spend` (= monthly_expenses×12, applied during decumulation after retirement), `expected_return` (mean), `return_volatility` (stdev), `inflation` (work in today's dollars, i.e. use real return = expected_return − inflation or discount nominal — keep it simple and documented).
- For each of **N=5,000–10,000 runs**, step year by year from current_age to end_age: `balance = balance * (1 + sampled_annual_return) + contribution (if age<retirement) − spend (if age≥retirement)`, where `sampled_annual_return ~ Normal(mean, stdev)` (seedable RNG for reproducibility). Floor balance at 0 for the "money lasts" test.
- Aggregate per age: P10, P25, P50, P75, P90. Compute KPIs: **% of runs with balance > 0 at end_age** ("chance money lasts"), median NW at retirement and at end_age, median balance at retirement, withdrawal starting rate (annual_spend ÷ balance_at_retirement). Return a typed result object (the shape in the UC1 spec's "Output shape").
- **Market downturn** toggle: lower mean return and raise volatility (and/or apply a one-off shock in an early year). **Save more / Retire earlier / Live longer:** adjust the corresponding input before simulating.

### The 30 client segments (synthetic)

Generate **30 diverse segments** spanning the Tangerine wealth spectrum (tie loosely to the three personas: Elena emerging $0–100K, Elijah switcher $100–500K, Esme mass-affluent $500K–1MM+). Vary meaningfully across: age (25–70), net worth, assets vs liabilities/debt, income, contribution rate, spend, asset mix / risk profile, and retirement age. Include clearly **on-track**, **borderline**, and **at-risk** archetypes so the badge shows green/amber/red across the set. Give each a short human label (e.g. "Early-career saver, high debt", "Mid-career mortgage-heavy accumulator", "Pre-retiree, conservative, well-funded", "Over-spender at risk"). Store them as a JSON/seed file so they're easy to edit. (This stands in for the future ML **segmentation model** — document that swap-in point in code + README.)

### AI summary generation

- Default: a **deterministic, templated generator** that composes the narrative, headline, highlights, "Why?" grounding, and scenario-delta sentences **from the simulation numbers** (never invents figures). Vary tone by band and by how far from the 90% goal.
- Provide an **optional real-LLM mode** behind an env flag (e.g. `LLM_MODE=openai` with `OPENAI_API_KEY`) that sends the simulation result + guardrails and returns the same JSON shape. Off by default so the demo runs offline.
- **Guardrails in the copy:** today's-dollars caveat; "taxes not modelled"; "general information, not advice"; segment = personalization not a guarantee. Every number in the narrative must come from the sim result.

### Tech & structure

- **Stack:** React + Vite + TypeScript, a charting lib (Recharts or visx), and a small TS module for the Monte Carlo engine and the summary generator (pure functions, unit-testable). No backend required (run engine client-side); if you add the optional LLM mode, use a tiny serverless/proxy route so the key isn't exposed. Keep everything in one repo.
- **Files (suggested):** `src/engine/monteCarlo.ts`, `src/engine/summary.ts`, `src/data/segments.json`, `src/components/{ClientPanel,MobileFuture,FanChart,AiSummaryCard,ScenarioToggles,OutcomeDistribution,GoalGauge}.tsx`, `src/App.tsx`.
- **Reproducibility:** seed the RNG; expose a "runs" and "seed" control (dev only).
- **Tests:** unit-test the engine (e.g. zero-volatility path equals the deterministic compound-growth curve; higher contributions ⇒ higher median; higher spend ⇒ lower "money lasts %"). Add a couple of summary-grounding tests (every number in the text appears in the sim result).
- **README:** one-command run (`npm i && npm run dev`), how to edit segments, how to flip the optional LLM mode, and **where the real segmentation model and real Monte Carlo assumptions (Wealth Studio CMAs) would plug in** later.

### Visual style

Approximate the Tangerine mobile aesthetic: clean, rounded cards (radius ~16), large title (~24), body (~17), a phone frame on the right, orange accent, green/amber/red for the badge. It doesn't need to be pixel-perfect — it needs to read as the "My Future" tab with the AI summary layered in.

### Acceptance criteria

1. `npm run dev` opens a two-column page; left = 30 personas + Custom with editable data; right = phone-framed "My Future" tab.
2. Selecting a persona (or editing any field) **re-runs a real Monte Carlo** and updates the fan chart, KPIs, badge, AI summary, and extra visualizations live.
3. The AI summary is **expandable/interactive**, explains the retirement outlook ("how they'll be in retirement"), updates with the scenario toggles, and every figure traces to the simulation.
4. On-track, borderline, and at-risk personas each render the correct green/amber/red badge. Engine has passing unit tests. Runs fully offline by default.

## Notes for whoever runs this prompt

- This is a **front-end mock**: the 30 segments stand in for the future **ML segmentation model**, and the local Monte Carlo stands in for the real engine + **Wealth Studio capital-market assumptions** (D12, still TBD). Both swap-in points should be documented in the demo's README so it can graduate to real data via the [data product](data-product-persona-fields.md).
- Keep the output JSON shape aligned with the UC1 spec so the mock and the real service are interchangeable.
