# 3 · Simulation Engine

`src/engine/monteCarlo.ts` — pure TypeScript, no dependencies, unit-tested.

## Purpose

Produce, for one client, the distribution of possible net-worth paths from today to life expectancy,
and from it the chart series (`G1–G13` in the data inventory) and the KPIs the “My Future” tab shows.
It deliberately mirrors the **MVP POC engine’s simplifications** so the AI summary can only ever
*explain* the product’s forecast, never extend it.

## Inputs

Derived from the client fields by `toSimInputs()`:

| Engine input | From client field | Notes |
|---|---|---|
| `current_age`, `retirement_age`, `end_age` | age, retirement age, life expectancy | `end_age` is the planning horizon |
| `starting_net_worth` | net worth (= assets − liabilities) | one balance; no per-account modelling |
| `annual_contribution` | monthly contributions × 12 | applied while `age < retirement_age` |
| `annual_spend` | monthly expenses × 12 | applied while `age ≥ retirement_age` |
| `expected_return`, `return_volatility` | % → decimals | mean / stdev of the yearly return |
| `inflation` | % → decimal | used to convert to a *real* return |
| `runs`, `seed` | dev controls | default **5,000** runs, seed **42** |
| `shock` (optional) | market-downturn toggle | one-off drop in a given year |

Risk-profile presets (set by the *Risk profile* selector, still editable afterwards):

| Profile | Expected return | Volatility | Mix (equity / fixed income / cash) |
|---|---|---|---|
| Conservative | 4.0 % | 6 % | 30 / 55 / 15 |
| Balanced | 5.5 % | 9 % | 55 / 35 / 10 |
| Growth | 7.0 % | 13 % | 75 / 20 / 5 |
| Aggressive | 8.0 % | 17 % | 90 / 8 / 2 |

The asset mix is informational in the demo; the engine uses the return/volatility pair. (In
production the mix would drive per-asset-class capital-market assumptions — see [07](07-path-to-production.md).)

## The math

Everything is in **today’s dollars**. Each year’s return is sampled as a *real* return:

```
r  ~  Normal( expected_return − inflation ,  return_volatility )
```

For each of the N runs, year by year from `current_age` to `end_age`:

```
balance = balance × (1 + r)
        + annual_contribution   if age <  retirement_age
        − annual_spend          if age >= retirement_age
balance = max(balance, 0)
```

A one-off **shock** (market-downturn toggle) multiplies the balance by `(1 − drop)` in the configured year.

Because contributions and spending are held flat in real terms and returns are real, the output is
directly comparable to the POC’s “shown in today’s dollars” disclaimer.

### Randomness and reproducibility

- Uniforms come from **mulberry32** seeded with `seed`; normals from the **Box–Muller** transform.
- Same inputs + same seed ⇒ bit-identical paths, percentiles and KPIs (tested). This is what makes a
  presentation repeatable and lets two people compare screens.
- Different seeds give different paths (tested), so “5,000 runs” is a genuine sample, not a lookup.

## Outputs

### Series (per age) — the fan chart

`p10, p25, p50, p75, p90` of the balance across all runs at that age (linear interpolation between
order statistics). The chart draws the outer band P10–P90, the inner band P25–P75 and the dashed
median, shades the decumulation phase and marks the retirement age.

### KPIs

| KPI | Definition |
|---|---|
| `money_lasts_pct` | % of runs whose balance is **> 0 at `end_age`** — *“chance money lasts”* |
| `band` | **Good ≥ 90 · Borderline 75–89 · At Risk < 75** (thresholds from the data inventory, G8) |
| `nw_at_retirement` / `balance_at_retirement` | median balance at retirement age |
| `nw_at_65` | median at 65 (clamped into the horizon) — the “projected net worth at 65” chip |
| `nw_at_end` | median at end age — the “legacy at 90” line |
| `withdrawal_rate_pct` | annual spend ÷ median balance at retirement |
| `median_runs_out_age` | first age after retirement where the median path is $0, if any |
| `ending_balances` | every run’s final balance — feeds the outcome histogram |

## Scenario toggles

`src/engine/scenarios.ts` turns each quick scenario into a change of engine inputs:

| Toggle | Change | Mirrors |
|---|---|---|
| Save more | contributions **+ $500 / month** | I6 |
| Retire earlier | retirement age **− 5 years** | I7 |
| Live longer | end age **+ 5 years** | I8 |
| Market downturn | expected return **− 2 pts**, volatility **× 1.5**, and a **−20 % shock in year 2** | I9 (stress test) |

Toggles combine; the summary’s delta sentence compares the toggled result with the untoggled baseline.

## The pipeline around the engine

One press of **Run outlook** runs seven simulations (baseline, active, four single-toggle readings,
and two “positive lever” variants: retire 5 years *later*, spend 10 % less). At 5,000 runs × ~50
years this is ~1.75 M path-years — about **100 ms** in a modern browser, which is why it can run
client-side and synchronously.

## What the engine does *not* do (by design)

These match [`../context/05-projection-engine-assumptions.md`](../context/05-projection-engine-assumptions.md):

- **No taxes**, and registered accounts (TFSA/RRSP) are treated like any other balance.
- **Constant mix** — no rebalancing or glide path.
- **No product/fee modelling** — MER is not applied (it is a data-product field, `D11`, available for a later step).
- **No guaranteed income** (CPP/OAS/pension — `D18/D19`, undecided in the data inventory).
- **No sequence-of-returns sophistication** beyond yearly normal sampling; no fat tails or correlation structure
  (that is what Wealth Studio capital-market assumptions, `D12`, would bring).

## Validation (see [06](06-quality-security-compliance.md))

- Zero volatility reproduces the closed-form compound-growth curve exactly.
- Higher contributions ⇒ higher median at retirement; higher spend ⇒ lower chance money lasts.
- Percentiles are ordered at every age; balances never go negative; ruin is counted correctly.
- Band thresholds and every toggle’s effect are asserted.
