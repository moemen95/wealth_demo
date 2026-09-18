# Tiered Model Strategy

> **Source:** `Tiered Model Strategy May 26.pptx`. This is the commercial/strategic frame. For the AI work, the key takeaways are (a) which tier unlocks which capability, and (b) that AI features are named explicitly across tiers.

## 1. Tier architecture & thresholds

Three tiers, keyed to **investable assets** (GICs min $1 AUM/A, MFs, DIY investing, managed assets). Clients land in the **highest qualifying tier**.

| | Everyday Wealth (T1) | Preferred Wealth (T2) | Ultra / Premier Wealth (T3) |
|---|---|---|---|
| **Threshold** | $25K–$250K investments | $250K–$500K investments **OR** $500K + deposits only **OR** $3MM+ property value **OR** Horizon credit card | $500K+ investments |
| **Prosperity bundle** | Good / Better | Best | Best |
| **Advisor model** | Team of licensed Wealth advisors | + Dedicated advisor (PFP) + insurance specialists | + Dedicated CFP advisor (min $500K managed) + complex-wealth specialists |
| **Financial planning** | DIY planning: goals, scenario modelling, **AI-enabled features** | + Advisor-led goals-based planning (retirement, tax, withdrawals) + tax-loss harvesting advice | + Holistic CFP planning (will/estate, insurance) |
| **Managed solutions** | ❌ (DIY only) | ✔ (min $100K) + SMA | ✔ reduced fees + UMA/UMH + advisor-led personalized portfolios & asset location |
| **Visual identity** | Standard branding + tier progress tracker | Preferred | "Tangerine Ultra" exclusive header |

Naming note: the deck uses **"Ultra Wealth"** and **"Premier Wealth"** interchangeably for T3 across draft iterations — treat as the same tier.

## 2. Where AI is explicitly promised (verbatim from the deck)

These are the product commitments the code in this repo implements:

- **Financial Planning:** "Goal setting, budgeting, scenario modelling, and tracking" + "**AI agent for personalized guidance**".
- **Portfolio Review & Analysis:** "**AI-assisted market research and portfolio analysis**".
- **Portfolio Construction & Mgmt.:** "**AI-powered capabilities**".
- Everyday-tier planning: "DIY financial planning solution including goal planning, scenario modelling, **AI-enabled features** etc."
- Strategy-design rows: "DIY financial planning, **AI-powered planning prompts**".
- Competitor watch: Questrade/Wealthsimple "**agentic finance**" — set up trading rules via natural-language prompts; Questrade MCP integrates with Claude/ChatGPT; IBKR "**AI News Summaries**". (Signals the market direction for agentic AI.)

**Implication:** AI planning/insight features are positioned as a **cross-tier foundation** (available even at Everyday), with depth increasing by tier. Design the three use cases to degrade gracefully by tier rather than being tier-gated.

## 3. Value-prop levers (what differentiates tiers)

1. **Advisor Model** — primary differentiator (team → dedicated → CFP).
2. **Digital Interface** — tier-specific visual cues, progress-to-next-tier.
3. **Investment Products & Platform** — advanced solutions unlock with complexity.
4. **Partner Benefits** — curated 3P offers (wills, estate, insurance).

## 4. Competitor benchmarking (why this matters for AI framing)

| Player | Tiering archetype | Notable digital/AI feature |
|---|---|---|
| Wealthsimple | Visible **status** (app colors, fee breaks) | "Balance sheet" whole-portfolio view (coming) |
| Questrade / Questwealth | **Price**-led | **Agentic finance** (NL trading rules), Questrade MCP, Flows |
| BMO adviceDirect | **Guided tools** | Research, ratings, ESG, WealthPath planning |
| Vanguard PAS | **Advice depth** ladder | Consistent digital across tiers |
| Merrill Guided Investing | Digital→advisor upgrade | Goal-setting dashboard |
| IBKR | — | **AI news summaries**, fundamentals explorer, risk navigator |
| SoFi | Membership | Unlimited planning sessions |

**Key insight from the deck:** upper tiers need "visible status cues, portfolio insights and planning tools that make the tier feel materially different." AI summary/insight/suggestion features are a direct lever for this.

## 5. Fees (context for UC1/UC3 fee-awareness)

- DIY: commission-free trading; managed solutions all-in fees step down with AUM (~0.9% $100K–$499K → 0.7% $500K–$999K → 0.5% $1MM+).
- BAU mutual funds currently ~0.76–1.08% (Everyday).
- Fee/MER data (`D11`) is available and can power fee-awareness in AI outputs.
