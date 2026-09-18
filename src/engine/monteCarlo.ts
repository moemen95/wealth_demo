import { makeNormal } from './rng.ts'
import type { Band, ClientInputs, SeriesPoint, SimInputs, SimKpis, SimResult } from './types.ts'

export const DEFAULT_RUNS = 5000
export const DEFAULT_SEED = 42

/** Band thresholds from the data inventory (G8): Good ≥90 / Borderline 75–89 / At Risk <75. */
export function bandFor(pct: number): Band {
  if (pct >= 90) return 'Good'
  if (pct >= 75) return 'Borderline'
  return 'At Risk'
}

/** Map the editable client fields onto engine inputs. Percent fields become decimals here. */
export function toSimInputs(c: ClientInputs, runs = DEFAULT_RUNS, seed = DEFAULT_SEED): SimInputs {
  return {
    current_age: c.age,
    retirement_age: c.retirement_age,
    end_age: c.life_expectancy,
    starting_net_worth: c.net_worth,
    annual_contribution: c.monthly_contributions * 12,
    annual_spend: c.monthly_expenses * 12,
    expected_return: c.expected_return / 100,
    return_volatility: c.return_volatility / 100,
    inflation: c.inflation / 100,
    runs,
    seed,
  }
}

function percentile(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/**
 * Real, simple Monte Carlo. Works in TODAY'S DOLLARS: the sampled return is a *real* return,
 * Normal(expected_return − inflation, volatility). Contributions and spend are therefore held flat
 * in real terms (matches the POC engine's "today's dollars" disclaimer). Nothing tax-aware — by design.
 *
 * Per run, per year (age → age+1):
 *   balance = balance * (1 + r) + contribution (if age < retirement) − spend (if age ≥ retirement)
 * Balance is floored at 0; a run "lasts" if balance > 0 at end_age.
 */
export function simulate(inputs: SimInputs): SimResult {
  const { current_age, retirement_age, end_age, starting_net_worth, annual_contribution, annual_spend } = inputs
  const runs = Math.max(1, Math.floor(inputs.runs))
  const years = Math.max(0, end_age - current_age)
  const real_return = inputs.expected_return - inputs.inflation
  const normal = makeNormal(inputs.seed, real_return, inputs.return_volatility)

  // balances[y] holds every run's balance at age current_age + y (y = 0 is the starting point).
  const balances: Float64Array[] = Array.from({ length: years + 1 }, () => new Float64Array(runs))
  for (let i = 0; i < runs; i++) {
    let bal = starting_net_worth
    balances[0][i] = bal
    for (let y = 0; y < years; y++) {
      const age = current_age + y
      const r = normal()
      bal = bal * (1 + r)
      if (inputs.shock && y === inputs.shock.year_index) bal *= 1 - inputs.shock.drop
      bal += age < retirement_age ? annual_contribution : -annual_spend
      if (bal < 0) bal = 0
      balances[y + 1][i] = bal
    }
  }

  const series: SeriesPoint[] = balances.map((arr, y) => {
    const sorted = arr.slice().sort()
    return {
      age: current_age + y,
      p10: percentile(sorted, 0.1),
      p25: percentile(sorted, 0.25),
      p50: percentile(sorted, 0.5),
      p75: percentile(sorted, 0.75),
      p90: percentile(sorted, 0.9),
    }
  })

  const ending = balances[years]
  let survived = 0
  for (let i = 0; i < runs; i++) if (ending[i] > 0) survived++
  const money_lasts_pct = Math.round((survived / runs) * 100)

  const at = (age: number) => series.find((s) => s.age === age)?.p50 ?? null
  const clampAge = (age: number) => Math.min(Math.max(age, current_age), end_age)
  const nw_at_retirement = at(clampAge(retirement_age)) ?? 0
  const nw_at_65 = at(clampAge(65)) ?? nw_at_retirement
  const nw_at_end = series[series.length - 1]?.p50 ?? 0
  const withdrawal_rate_pct =
    nw_at_retirement > 0 && annual_spend > 0 ? Math.round((annual_spend / nw_at_retirement) * 1000) / 10 : null
  const runsOut = series.find((s) => s.age > retirement_age && s.p50 <= 0)
  const kpis: SimKpis = {
    money_lasts_pct,
    band: bandFor(money_lasts_pct),
    nw_at_retirement: Math.round(nw_at_retirement),
    nw_at_65: Math.round(nw_at_65),
    nw_at_end: Math.round(nw_at_end),
    balance_at_retirement: Math.round(nw_at_retirement),
    withdrawal_rate_pct,
    median_runs_out_age: runsOut ? runsOut.age : null,
  }

  return { runs, seed: inputs.seed, real_return, inputs, series, kpis, ending_balances: ending }
}
