import type { ScenarioToggles, SimInputs } from './types.ts'

/** Quick-scenario deltas — mirrors the real app's toggles (I6–I9 in the data inventory). */
export const SCENARIO = {
  save_more_monthly: 500, // +$500/mo
  retire_earlier_years: 5, // −5y
  live_longer_years: 5, // +5y
  /** Market downturn stress: lower mean, higher vol, and a one-off −20% shock in year 2. */
  downturn: { return_delta: -0.02, vol_multiplier: 1.5, shock: { year_index: 1, drop: 0.2 } },
} as const

export const NO_TOGGLES: ScenarioToggles = { save_more: false, retire_earlier: false, live_longer: false, market_downturn: false }

/** Apply the active toggles to a baseline set of engine inputs (pure; returns a new object). */
export function applyToggles(base: SimInputs, t: ScenarioToggles): SimInputs {
  const out: SimInputs = { ...base }
  if (t.save_more) out.annual_contribution = base.annual_contribution + SCENARIO.save_more_monthly * 12
  if (t.retire_earlier) out.retirement_age = Math.max(base.current_age + 1, base.retirement_age - SCENARIO.retire_earlier_years)
  if (t.live_longer) out.end_age = base.end_age + SCENARIO.live_longer_years
  if (t.market_downturn) {
    out.expected_return = base.expected_return + SCENARIO.downturn.return_delta
    out.return_volatility = base.return_volatility * SCENARIO.downturn.vol_multiplier
    out.shock = { ...SCENARIO.downturn.shock }
  }
  // Keep the horizon sane if a toggle pushes retirement past end age.
  if (out.retirement_age >= out.end_age) out.retirement_age = out.end_age - 1
  return out
}

export const TOGGLE_LABELS: Record<keyof ScenarioToggles, { title: string; caption: string }> = {
  save_more: { title: 'Save more', caption: `Increase monthly contributions by $${SCENARIO.save_more_monthly}` },
  retire_earlier: { title: 'Retire earlier', caption: `Retire ${SCENARIO.retire_earlier_years} years earlier than planned` },
  live_longer: { title: 'Live longer', caption: `Plan for living ${SCENARIO.live_longer_years} years longer` },
  market_downturn: { title: 'Market downturn', caption: 'Stress test: weaker returns, higher volatility, early shock' },
}
