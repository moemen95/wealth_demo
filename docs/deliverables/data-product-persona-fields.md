# Deliverable A — Persona Data Product (Fields, Sources, Hand-off)

**Purpose:** the data product an engineering session needs to power the three AI use cases for the Wealth persona. It lists **every field, its source system, its availability, and the binding work required** — structured so it can be handed to a session that has access to the Tangerine database schema.

> **Status:** binding to the real EDW GCP (BigQuery) schema is now in progress. Batch 1 (mutual-fund holdings + txns + customer/account backbone) is bound below and documented in [../context/06-edw-schema-reference.md](../context/06-edw-schema-reference.md). Remaining fields still show their **source system** and a `TODO` in "Bind to" for Batch 2 (deposits/GIC/mortgage/LoC balances, card-spend txns, KYC identity, fees). Refs (`D#` / `I#`) trace to [../context/04-data-inventory.md](../context/04-data-inventory.md).
>
> **EDW access (confirmed 2026-09-12):** project `tng-edw-views-01-tqa`, dataset `EDW_VIEWS`, via SA `sa-aichat@tng-chatai-lab.iam.gserviceaccount.com` (impersonation). Run query jobs from `tng-chatai-lab` against the legacy endpoint `www.googleapis.com/bigquery/v2` (see the reference doc for why).

## A.1 The data product, at a glance

One logical entity: `ClientWealthProfile` (per client), composed of four domains. Each AI use case consumes a subset.

```
ClientWealthProfile
├── identity_profile       → D1, D2                            (UC1, UC2)
├── net_worth_snapshot     → D3, D4, D5, D10, D11, Historical NW   (UC1, UC2, UC3)
├── contributions_flows    → D6, D7, transactions              (UC1, UC2, UC3)
└── projection_assumptions → D8, D9, D12, D13, D14–D20         (UC2)
```

## A.2 Field catalog (hand-off table)

Legend — **Avail:** 🟢 Yes · 🟡 Partial · 🔴 No/TBD. **Used by:** which UC(s).

### Domain 1 — Identity & Profile

| Ref | Field | Source system | Grain | Avail | Used by | Bind to (TODO) | Notes / action |
|---|---|---|---|---|---|---|---|
| D1 | Date of birth / current age | KYC / client profile | client | 🟢 | UC1,UC2 | ✅ `F_CUST_PRFL.BIRTH_DT` (94% populated) via `CUSTOMER_KEY` | drives age axis & horizon |
| D2 | Annual income | KYC / onboarding | client | 🟢 | UC1,UC2,UC3 | 🟡 `F_CUST_FIN_PLAN.MONTHLY_INCOME_AMT` (×12, self-entered) or `D_MF_INVESTOR_CHAR.NET_INCOME` (band); no $ on `F_CUST_PRFL`/employment | confirm authoritative |
| — | Join key (client ↔ accounts) | EDW | client/account | 🟢 | all | ✅ `F_CUST_ACCT_REF.CUSTOMER_KEY` / `ACCOUNT_KEY` (filter `CURRENT_IND` / `DELETED_IND`) | backbone for assembling the profile |
| — | Client tier (Everyday/Preferred/Ultra) | derived (thresholds) | client | 🟡 | all | *derive* | compute from investable assets per tier rules |
| — | Persona bucket | derived (asset band) | client | 🟡 | all | *derive* | for tone/defaults; optional |

### Domain 2 — Net Worth Snapshot

| Ref | Field | Source system | Grain | Avail | Used by | Bind to (TODO) | Notes / action |
|---|---|---|---|---|---|---|---|
| D5 | Total net worth (assets − liabilities) | Net Worth service | client | 🟢 | UC1,UC2 | ✅ assemble: asset balances + `F_CRDT_CARD` / `F_MTG_RES` / `F_LOAN_KEY_MEAS_DAILY` liabilities, split by `F_CUST_ACCT_REF.LIABILITY_IND` | confirm vs Net Worth service |
| D3 | Tangerine balances (chequing, savings, GIC, managed portfolios) | Core banking + Wealth platform | account, daily | 🟢 | UC1,UC2,UC3 | ✅ `F_DDA` / `F_SAV` / `F_GIC` / `F_MF_KEY_MEAS_DAILY.END_BALANCE` (or unified `F_ACCT_KEY_MEAS_DAILY`) | starting assets |
| D4 | External accounts (assets & liabilities) | App-stored (user-entered) | item | 🟡 | UC1,UC2 | 🟡 `F_CUST_OTHER_FI_ACCT_INFO` (in EDW but sparse: ~699 rows) | unverified; low coverage today |
| D10 | Asset allocation / asset class per holding | Wealth platform | holding | 🟡 | UC1,UC2 | 🟡 `MF_PORTFOLIO_KEY` → `D_MF_PORTFOLIO`; fin-plan `ASSET_CATEGORY` | missing for external/custom |
| D11 | Product fees (MER) | Product/fund data | fund | 🟢 | UC1,UC3 | 🟡 `F_ACCT_FEE` (⚠️ **not** in `D_MUTUAL_FUND` — no MER col there) | confirm fee grain |
| D20 | Liability terms (rate, amortization) | Lending / user-entered | liability | 🟡 | UC3 | ✅ `F_MTG_RES_KEY_MEAS_DAILY` (rate, PI pmt, maturity, LTV), `F_LOAN_KEY_MEAS_DAILY` | now available in EDW |
| — | 1-yr net-worth history | Midas team | client, daily | 🟢 | UC1 | ✅ daily key-meas facts per product (MF 2023-06→current); assemble across products | internal only; external is effective-date based |

### Domain 3 — Contributions & Flows

| Ref | Field | Source system | Grain | Avail | Used by | Bind to (TODO) | Notes / action |
|---|---|---|---|---|---|---|---|
| D6 | PAC / ASP scheduled contributions | Investment platform | schedule | 🟢 | UC1,UC2,UC3 | ✅ MF: `F_MF_TXN` purchases + `FREQUENCY_KEY` → `D_FREQUENCY` | normalise freq → monthly |
| D7 | Avg monthly spend (card, last 6 mo) | Transaction aggregation | client | 🟢 | UC1,UC3 | ✅ `F_CRDT_CARD_TXN` (fresh to 2026-09-10) + `F_ACCT_TXN` | aggregate card + debit spend |
| — | Transaction stream (categorized, ≥6 mo) | Transaction aggregation | transaction | 🟢 | UC3 | ✅ `F_CRDT_CARD_TXN.MERCHANT_CATEGORY_KEY` + `MERCHANT_NAME` + `RECURRING_IND` | native categories & recurring detection |

### Domain 4 — Projection Assumptions (UC2)

| Ref | Field | Source system | Grain | Avail | Used by | Bind to | Notes / action |
|---|---|---|---|---|---|---|---|
| D8 | Investment profile / model portfolio | Wealth platform | portfolio | 🟢 | UC2 | 🟡 `MF_PORTFOLIO_KEY` → `D_MF_PORTFOLIO`; risk via `MF_INVESTOR_CHAR_KEY` → `D_MF_INVESTOR_CHAR` | expected return |
| D9 | Projected RoR per portfolio | Wealth platform / CMA | portfolio/class | 🟡 | UC2 | *TODO* | external accounts have none |
| D12 | Capital market assumptions (return, vol, correlations) | **Wealth Studio** / research | asset class | 🔴 | UC2 | *engine API* | confirm callable from mobile |
| D13 | Inflation assumption | Assumptions library / economics | global | 🟢 | UC2 | *config* | reconcile w/ 3% build default |
| D14 | Account tax type (reg/non-reg/TFSA) | Account metadata | account | 🟢 | UC2 | 🟢 `D_REG_ACCOUNT.PLAN_TYPE_DESC` (Regular/Spousal/Locked-In/Group) + product type for TFSA/non-reg | for decumulation (not modelled in MVP) |
| D15 | RRSP/TFSA contribution room | Registered plan / CRA | client | 🟡 | UC2 | *feed* | optional MVP1 |
| D16 | RRIF min withdrawal factors | CRA static table | by age | 🟢 | UC2 | *static* | load into engine |
| D17 | Marginal tax rates | Tax tables (income/province) | bracket | 🔴 | UC2 | *table* | decide pre/post-tax |
| D18 | CPP / OAS entitlement | Self-entered or CRA | client | 🔴 | UC2 | *tbd* | source undecided |
| D19 | Pension income | Self-entered | client | 🔴 | UC2 | *tbd* | capture UX undecided |

### User-adjustable inputs (`I#`) — override layer over the above

`I1–I17` (income, assets, liabilities, contributions, expenses, quick-scenario toggles, sliders, market outlook, inflation, return). Full table in the [data inventory](../context/04-data-inventory.md). These are **write** fields (client input), stored per scenario; the rest are **read** fields sourced from systems.

## A.3 Per-use-case minimum viable dataset

| Use case | Green-only MVP possible? | Minimum fields |
|---|---|---|
| UC1 Summary | ✅ Yes — data-ready in EDW | D1, D3, D5, D6, Historical NW bound; D2/D4/D10/D11 enrich |
| UC3 Spending | ✅ Yes — now unblocked | D3, D6, D7 (`F_CRDT_CARD_TXN` w/ category + recurring), D20 all bound |
| UC2 Future | 🟡 Data mostly bound; blocked only on D12 (CMAs) & tax scope | I2/I3, D1, I10/I11, D6, D8, D10 bound; needs D9/D12/D13 assumptions |

## A.4 EDW binding progress

- ✅ **Batch 1 bound (2026-09-12)** — mutual-fund holdings (`F_MF_KEY_MEAS_DAILY`), MF transactions (`F_MF_TXN`), customer/account backbone (`F_CUST_ACCT_REF`), all in `tng-edw-views-01-tqa.EDW_VIEWS`. Covers D3 (MF), D5 split, D6, D8, D10, D11, D14, Historical NW (MF), identity join keys.
- ✅ **Batch 2 bound (2026-09-12)** — deposits/GIC/card/mortgage/loan balances, card spend, and identity. Full detail in [../context/06-edw-schema-reference.md](../context/06-edw-schema-reference.md):
  - **Deposits/GIC** → `F_DDA_KEY_MEAS_DAILY`, `F_SAV_KEY_MEAS_DAILY`, `F_GIC_KEY_MEAS_DAILY` (or unified `F_ACCT_KEY_MEAS_DAILY`) — D3, Historical NW.
  - **Mortgage / loan / LoC** balances + rates/terms → `F_MTG_RES_KEY_MEAS_DAILY`, `F_LOAN_KEY_MEAS_DAILY`, `F_CRDT_CARD_KEY_MEAS_DAILY` — D5 liabilities, D20.
  - **Card spend (categorized + recurring)** → `F_CRDT_CARD_TXN` (`MERCHANT_CATEGORY_KEY`, `RECURRING_IND`) — D7 & UC3 (fresh to 2026-09-10).
  - **Identity** → `F_CUST_PRFL.BIRTH_DT` (D1, 94% populated); D2 income still to confirm source (`F_CUST_EMPLOYMENT_HIST` / KYC / `D_MF_INVESTOR_CHAR`).
  - **External accounts (D4)** → `F_CUST_OTHER_FI_ACCT_INFO` (exists but sparse).
  - 🔍 **Existing FP/goals model discovered** (`F_CUST_FIN_PLAN_ASSET`/`LIABILITY`/`GOAL`/`RECOMMEND`, 35,798 plans) — carries contributions/RoR/asset-class/liabilities; **evaluate reuse for UC2** scenario storage.
- ⬜ **Still external to EDW / undecided:** D9 (per-portfolio RoR), D12 (Wealth Studio CMAs), D13 (inflation config), D15 (contribution room), D16 (RRIF), D17 (tax rates), D18 (CPP/OAS), D19 (pension).

## A.5 Hand-off checklist for the DB-context session

1. ~~Bind each `D#` to concrete tables/columns~~ — ✅ Batch 1 & 2 done (MF, deposits, GIC, cards, mortgage, loan, identity, external, spend).
2. Confirm net worth (D5) assembly from EDW per-account balances + `LIABILITY_IND` reconciles with the Net Worth service.
3. Confirm **Midas** historical NW vs. assembling history from the daily key-meas facts (retention ≥1 yr).
4. ~~Confirm transaction aggregation (D7)~~ — ✅ bound to `F_CRDT_CARD_TXN`; resolve `MERCHANT_CATEGORY_KEY` dim + confirm mobile exposure.
5. Resolve **PAC/ASP** frequency normalization (D6 → monthly); confirm txn-type/frequency combos.
6. Decide **Wealth Studio (D12)** callable-from-mobile vs. asset-class default fallback.
7. Decide **tax scope (D14/D17)**: pre- vs post-tax projection; registered handling.
8. Confirm **D2 income** authoritative source.
9. Confirm **PII/consent** posture for transaction categorization (UC3).
10. **PROD vs TQA:** confirm production project names (these are `*-tqa`) and partition/cluster keys (esp. `SNAPSHOT_DT`) for cost control.
11. Evaluate reusing `F_CUST_FIN_PLAN_*` as the UC2 scenario store.
