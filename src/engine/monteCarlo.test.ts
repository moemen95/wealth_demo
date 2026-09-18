import { describe, expect, it } from 'vitest'
import { bandFor, simulate, toSimInputs } from './monteCarlo.ts'
import { applyToggles, NO_TOGGLES, SCENARIO } from './scenarios.ts'
import type { ClientInputs, SimInputs } from './types.ts'

const base: SimInputs = {
  current_age: 40,
  retirement_age: 65,
  end_age: 90,
  starting_net_worth: 200_000,
  annual_contribution: 24_000,
  annual_spend: 48_000,
  expected_return: 0.055,
  return_volatility: 0.09,
  inflation: 0.025,
  runs: 2000,
  seed: 7,
}

describe('Monte Carlo engine', () => {
  it('zero-volatility path equals the deterministic compound-growth curve', () => {
    const r = simulate({ ...base, return_volatility: 0, runs: 3 })
    const real = base.expected_return - base.inflation
    let bal = base.starting_net_worth
    for (let age = base.current_age; age < base.end_age; age++) {
      bal = bal * (1 + real) + (age < base.retirement_age ? base.annual_contribution : -base.annual_spend)
      bal = Math.max(0, bal)
      const pt = r.series.find((s) => s.age === age + 1)!
      expect(pt.p50).toBeCloseTo(bal, 6)
      expect(pt.p10).toBeCloseTo(bal, 6) // no spread without volatility
      expect(pt.p90).toBeCloseTo(bal, 6)
    }
    expect(r.real_return).toBeCloseTo(real, 12)
  })

  it('is reproducible for the same seed and differs for another seed', () => {
    const a = simulate(base)
    const b = simulate(base)
    const c = simulate({ ...base, seed: base.seed + 1 })
    expect(a.series).toEqual(b.series)
    expect(a.kpis).toEqual(b.kpis)
    expect(a.series.some((p, i) => p.p50 !== c.series[i].p50)).toBe(true)
  })

  it('keeps percentiles ordered p10 ≤ p25 ≤ p50 ≤ p75 ≤ p90 at every age', () => {
    for (const p of simulate(base).series) {
      expect(p.p10).toBeLessThanOrEqual(p.p25)
      expect(p.p25).toBeLessThanOrEqual(p.p50)
      expect(p.p50).toBeLessThanOrEqual(p.p75)
      expect(p.p75).toBeLessThanOrEqual(p.p90)
    }
  })

  it('higher contributions ⇒ higher median at retirement', () => {
    const lo = simulate(base).kpis.nw_at_retirement
    const hi = simulate({ ...base, annual_contribution: base.annual_contribution * 2 }).kpis.nw_at_retirement
    expect(hi).toBeGreaterThan(lo)
  })

  it('higher spend ⇒ lower "money lasts %"', () => {
    const lo = simulate({ ...base, annual_spend: 30_000 }).kpis.money_lasts_pct
    const hi = simulate({ ...base, annual_spend: 120_000 }).kpis.money_lasts_pct
    expect(hi).toBeLessThan(lo)
  })

  it('never lets a balance go negative and counts survivors correctly', () => {
    const r = simulate({ ...base, annual_spend: 500_000 }) // guaranteed ruin
    expect(Math.min(...Array.from(r.ending_balances))).toBe(0)
    expect(r.kpis.money_lasts_pct).toBe(0)
    expect(r.kpis.band).toBe('At Risk')
    expect(r.kpis.median_runs_out_age).not.toBeNull()
  })

  it('maps bands on the documented thresholds', () => {
    expect(bandFor(100)).toBe('Good')
    expect(bandFor(90)).toBe('Good')
    expect(bandFor(89)).toBe('Borderline')
    expect(bandFor(75)).toBe('Borderline')
    expect(bandFor(74)).toBe('At Risk')
  })

  it('converts client fields to engine inputs (percent → decimal, monthly → annual)', () => {
    const client: ClientInputs = {
      age: 41, retirement_age: 65, life_expectancy: 90, net_worth: 140_000, total_assets: 520_000,
      total_liabilities: 380_000, debt: 380_000, annual_income: 110_000, monthly_contributions: 1500,
      monthly_expenses: 4200, asset_mix: { equity: 55, fixed_income: 35, cash: 10 },
      expected_return: 5.5, return_volatility: 9, inflation: 2.5, risk_profile: 'Balanced',
    }
    const s = toSimInputs(client, 100, 1)
    expect(s.annual_contribution).toBe(18_000)
    expect(s.annual_spend).toBe(50_400)
    expect(s.expected_return).toBeCloseTo(0.055)
    expect(s.inflation).toBeCloseTo(0.025)
    expect(s.starting_net_worth).toBe(140_000)
  })
})

describe('scenario toggles', () => {
  it('adjust the right input for each toggle', () => {
    expect(applyToggles(base, { ...NO_TOGGLES, save_more: true }).annual_contribution).toBe(
      base.annual_contribution + SCENARIO.save_more_monthly * 12,
    )
    expect(applyToggles(base, { ...NO_TOGGLES, retire_earlier: true }).retirement_age).toBe(
      base.retirement_age - SCENARIO.retire_earlier_years,
    )
    expect(applyToggles(base, { ...NO_TOGGLES, live_longer: true }).end_age).toBe(base.end_age + SCENARIO.live_longer_years)
    const down = applyToggles(base, { ...NO_TOGGLES, market_downturn: true })
    expect(down.expected_return).toBeLessThan(base.expected_return)
    expect(down.return_volatility).toBeGreaterThan(base.return_volatility)
    expect(down.shock).toBeDefined()
  })

  it('a market downturn lowers the chance money lasts', () => {
    const before = simulate(base).kpis.money_lasts_pct
    const after = simulate(applyToggles(base, { ...NO_TOGGLES, market_downturn: true })).kpis.money_lasts_pct
    expect(after).toBeLessThan(before)
  })
})
