# Data Inventory — Scenario Planning (Fields, Sources, Availability)

> **Source:** `Scenario Planning – Field & Data Inventory – 20260715.xlsx` (sheets: User Inputs, Internal System Data, Line Graph Data, Historical NW). This is the **most important data doc** for UC2 and a strong base for UC1/UC3. Refs are stable: `I#` inputs, `D#` internal data, `G#` chart series.

## 1. User Inputs (`I#`) — client-provided / adjustable

| Ref | Field | Control | Range / options | Prototype | Feeds |
|---|---|---|---|---|---|
| I1 | Annual income | Number | $0–500k | $2,000* | Income during accumulation |
| I2 | Total assets | Number | ≥ $0 | — | Starting net worth (pre-filled from Net Worth) |
| I3 | Total liabilities | Number | ≥ $0 | — | Starting net worth (pre-filled from Net Worth) |
| I4 | Monthly contributions | Number | ≥ $0 | $2,500 | Accumulation inflows |
| I5 | Monthly expenses | Number | ≥ $0 | $2,000 | Decumulation spend (pre-filled from avg card spend, last 6 mo) |
| I6 | Save More (toggle) | On/Off | +$500/mo (or +50%) | Off | Increases contributions |
| I7 | Retire earlier (toggle) | On/Off | −5 years | Off | Shifts retirement age |
| I8 | Live longer (toggle) | On/Off | +5 years | Off | Extends end age |
| I9 | Market downturn (toggle) | On/Off | lower return + higher inflation | Off | Stress test |
| I10 | Retirement age (slider) | 50–70 | — | 50 | Accumulation→decumulation boundary |
| I11 | Life expectancy (slider) | 50–100 | 80 | 80 | Chart end / decumulation length |
| I12 | Annual income (slider) | $80K–200K | $90,000 | Income during accumulation (dup of I1) | |
| I13 | Monthly contributions (slider) | $100–5K | $1,000 | Accumulation inflows | |
| I14 | Monthly expenses (slider) | $500–5K | $1,500 | Decumulation spend | |
| I15 | Market outlook (slider) | Worst/Expected/Best | Expected | Sets return & inflation defaults | |
| I16 | Inflation rate | derived | — | 3% | Real-dollar adjustment |
| I17 | Return rate | derived | — | 3% | Growth assumption |

*Prototype defaults are known-implausible placeholders — see open-questions. Onboarding I1/I4/I5 duplicate the Financial sliders I12/I13/I14 — authoritative source TBC.

## 2. Internal System Data (`D#`) — required to pre-fill & run the engine

This sheet **is effectively the data-sourcing map** for all three use cases.

| Ref | Data element | Source system | Granularity | Powers | Available? | Gap / action |
|---|---|---|---|---|---|---|
| D1 | Date of birth / current age | KYC / client profile | Per client | Age axis, horizon | Yes | — |
| D2 | Annual income | KYC / onboarding | Per client | I1/I12 | Yes | Confirm freshness vs KYC date |
| D3 | Tangerine balances (chequing, managed portfolios) | Core banking + Wealth platform | Per account, daily | Starting assets (I2) | Yes | — |
| D4 | External accounts (assets & liabilities) | App-stored, user-entered | Per item | Starting assets/liabilities | Partial | Unverified; no asset-class typing today |
| D5 | Total net worth (assets − liabilities) | Net Worth service | Per client | Starting value & pre-fill | Yes | Confirm it nets liabilities for projection |
| D6 | PAC / ASP scheduled contributions | Investment platform | Per schedule | Monthly contributions (I4/I13) | Yes | Normalise frequency (bi-weekly/semi-monthly) to monthly |
| D7 | Avg monthly spend | Transaction aggregation (card spend, last 6 mo) | Per client | Monthly expenses (I5/I14) | Partial | Confirm aggregate is exposed to mobile |
| D8 | Investment profile / model portfolio | Wealth platform | Per portfolio | Expected return | Yes | — |
| D9 | Projected rate of return per portfolio | Wealth platform / CMA | Per portfolio / asset class | Growth in accumulation | Partial | External accounts have no RoR — need class default or user input |
| D10 | Asset allocation / asset class per account | Wealth platform | Per holding | Per-class growth & volatility | Partial | Not captured for external/custom assets |
| D11 | Product fees (MER) | Product / fund data | Per fund | Net return | Yes | — |
| D12 | Capital market assumptions (return, vol, correlations) | Wealth Studio / research | Per asset class | Monte Carlo bands | TBD | Confirm Wealth Studio engine callable from mobile |
| D13 | Inflation assumption | Internal assumptions lib / economics | Global | Real-dollar adjustment | Yes | Set default; reconcile with build's 3% |
| D14 | Account tax type (registered / non-reg / TFSA) | Account metadata | Per account | Drawdown order & tax | Yes | Needed for decumulation sequencing |
| D15 | RRSP / TFSA contribution room | Registered plan data / CRA | Per client | Contribution limits (optional) | Partial | Optional for MVP1 |
| D16 | RRIF minimum withdrawal factors | Regulatory table (CRA) | By age | Mandatory decumulation | Yes (static) | Load into engine |
| D17 | Marginal tax rate assumptions | Tax tables (income/province) | Per bracket | Post-tax withdrawals | TBD | Decide pre- vs post-tax projection |
| D18 | CPP / OAS entitlement | Self-entered or CRA | Per client | Guaranteed income | No / TBD | Source undecided |
| D19 | Pension income | Self-entered | Per client | Guaranteed income | No / TBD | Capture UX undecided |
| D20 | Liability terms (rate, amortization) | Lending system / user-entered | Per liability | Debt paydown | Partial | No amortization schedule captured today |

## 3. Line Graph Data (`G#`) — the forecast chart series

| Ref | Series / value | Definition | Chart role |
|---|---|---|---|
| G1 | Age axis | current age → end age (life expectancy) | X-axis |
| G2 | Median net worth | 50th percentile of simulated paths per age | Centre line |
| G3 | Inner band | 25th / 75th percentile | Inner shaded band (tap-hold detail) |
| G4 | Outer band | 10th / 90th percentile | Outer shaded band (widens with horizon) |
| G5 | Retirement marker | vertical line at retirement age | Annotation (must reflect I10) |
| G6 | Phase split | accumulation (→retire) vs decumulation | Segment/shading; drives inflow vs withdrawal |
| G7 | Y-axis / $0 baseline | net worth $; full scale hidden | Y-axis / baseline |
| G8 | % likelihood money lasts | % of paths with NW > 0 through end age | Headline stat — **Good ≥90 / Borderline 75–89 / At Risk <75** |
| G9 | Projected net worth at 65 | median at 65 | KPI |
| G10 | Projected net worth at end age | median at end age (e.g. 90) | KPI |
| G11 | Annual savings | monthly contributions × 12 | Summary text |
| G12 | Balance at retirement | median at retirement age | Summary text |
| G13 | Withdrawal starting rate | annual withdrawal ÷ balance at retirement | Summary text |

The sheet also carries an **illustrative Monte-Carlo-style table** (per-age p10/p25/median/p75/p90) driven by inputs: current age, retirement age, end age, starting net worth, annual contribution, annual return (median, default 3% = Balanced portfolio), annual spend, and band spreads (inner ±0.10, outer −0.24/+0.26). This is the shape of data UC2 must produce/consume.

## 4. Historical Net Worth — data we have vs. don't

Goal: show **1 year of historical net worth** (tap chart → total NW / total assets / total liabilities). Historical data comes from the **Midas** team.

**Have (internal, daily, "current" balances):**

- Assets: Chequing, Savings, GICs (Banking); Internal Investments (Wealth, historical daily).
- Liabilities: Credit Cards, Mortgage, LoC (Banking).

**Don't have (external, effective-date based):**

- External assets: Business Interests & Investments, Personal Investment Accounts.
- External liabilities.

**External asset/liability rules (from the sheet):**

- Client inputs external items; displayed **as of the effective date** (else as of entry date).
- Growth rates apply to Business Interests/Investments & Personal Investment Accounts: if a rate is provided, apply it; if not, hold the principal balance flat.
- Principal changes update value as of the change/effective date; retroactive growth rates apply from the effective date.

## 5. Data-availability summary (traffic light)

- **Green (build now):** D1, D2, D3, D5, D6, D8, D11, D13, D14, D16 + internal balances/history via Midas.
- **Amber (needs work):** D4, D7, D9, D10, D15, D20 (external typing, spend aggregation exposure, per-portfolio RoR, allocation, contribution room, amortization).
- **Red / undecided:** D12 (Wealth Studio callable?), D17 (tax rates / pre-vs-post-tax), D18 CPP/OAS, D19 pension.
