/** Shared engine types. Kept free of React so the engine stays a pure, testable module. */

export type RiskProfile = 'Conservative' | 'Balanced' | 'Growth' | 'Aggressive'

/** Everything the left-hand "Client / Persona" panel edits. */
export interface ClientInputs {
  age: number
  retirement_age: number
  life_expectancy: number
  net_worth: number
  total_assets: number
  total_liabilities: number
  debt: number // "of which" debt (subset of liabilities)
  annual_income: number
  monthly_contributions: number
  monthly_expenses: number
  asset_mix: { equity: number; fixed_income: number; cash: number } // percentages, sum ≈ 100
  expected_return: number // % nominal, e.g. 5.5
  return_volatility: number // % stdev, e.g. 9
  inflation: number // %
  risk_profile: RiskProfile
}

export interface Segment extends ClientInputs {
  id: number
  label: string
  persona: 'Elena' | 'Elijah' | 'Esme'
}

/** Inputs the Monte Carlo engine actually consumes (derived from ClientInputs). */
export interface SimInputs {
  current_age: number
  retirement_age: number
  end_age: number
  starting_net_worth: number
  annual_contribution: number
  annual_spend: number
  expected_return: number // decimal nominal mean, e.g. 0.055
  return_volatility: number // decimal stdev
  inflation: number // decimal
  runs: number
  seed: number
  /** Optional one-off shock: multiply balance by (1 - drop) in the given year index (0 = first year). */
  shock?: { year_index: number; drop: number }
}

export interface SeriesPoint {
  age: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export type Band = 'Good' | 'Borderline' | 'At Risk'

export interface SimKpis {
  money_lasts_pct: number
  band: Band
  nw_at_retirement: number
  nw_at_65: number
  nw_at_end: number
  balance_at_retirement: number
  withdrawal_rate_pct: number | null
  /** First age (after retirement) at which the median path hits $0, or null if it never does. */
  median_runs_out_age: number | null
}

export interface SimResult {
  runs: number
  seed: number
  real_return: number // decimal, = expected_return - inflation (documented simplification)
  inputs: SimInputs
  series: SeriesPoint[]
  kpis: SimKpis
  /** Ending balance of every run (for the outcome-distribution histogram). */
  ending_balances: Float64Array
}

export interface ScenarioToggles {
  save_more: boolean
  retire_earlier: boolean
  live_longer: boolean
  market_downturn: boolean
}

export interface Highlight {
  label: string
  value: string
  band?: Band
  detail?: string
}

export interface Grounding {
  label: string
  value: string
}

/** The UC1 "Output shape" — see docs/use-cases/uc1-ai-financial-summary.md */
export interface SummaryOutput {
  segment_id: number | 'custom'
  segment_label: string
  horizon: { current_age: number; retirement_age: number; end_age: number }
  simulation: { runs: number; series: SeriesPoint[]; kpis: SimKpis }
  headline: string
  narrative: string
  highlights: Highlight[]
  visualizations: (
    | { type: 'fan_chart'; series_ref: 'simulation.series' }
    | { type: 'outcome_distribution'; metric: 'ending_net_worth' }
    | { type: 'goal_gauge'; target: number; current: number }
  )[]
  scenario_readings: { save_more: string; retire_earlier: string; live_longer: string; market_downturn: string }
  /** Sentence explaining the delta vs. the untoggled baseline when any toggle is on. */
  scenario_delta: string | null
  /** "Why?" grounding — the driving numbers behind the narrative. */
  why: Grounding[]
  disclaimers: string[]
  /** Every number the generator was allowed to use — tests assert the copy never strays outside it. */
  facts: Record<string, number>
  source: 'templated' | 'openai' | 'gemini'
}
