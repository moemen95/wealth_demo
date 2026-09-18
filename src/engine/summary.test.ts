import { describe, expect, it } from 'vitest'
import { allowedTokens, numbersIn, ungroundedNumbers } from './grounding.ts'
import { runPipeline } from './pipeline.ts'
import { NO_TOGGLES } from './scenarios.ts'
import type { ClientInputs, SummaryOutput } from './types.ts'

const client: ClientInputs = {
  age: 41, retirement_age: 65, life_expectancy: 90, net_worth: 140_000, total_assets: 520_000,
  total_liabilities: 380_000, debt: 380_000, annual_income: 110_000, monthly_contributions: 1500,
  monthly_expenses: 4200, asset_mix: { equity: 55, fixed_income: 35, cash: 10 },
  expected_return: 5.5, return_volatility: 9, inflation: 2.5, risk_profile: 'Balanced',
}
const seg = { id: 11, label: 'Mid-career mortgage-heavy accumulator' }

function assertGrounded(s: SummaryOutput) {
  const allowed = allowedTokens(s.facts)
  const texts = [
    s.headline,
    s.narrative,
    s.scenario_delta ?? '',
    ...Object.values(s.scenario_readings),
    ...s.highlights.flatMap((h) => [h.label, h.value, h.detail ?? '']),
    ...s.why.map((w) => w.value),
  ]
  for (const t of texts) {
    for (const n of numbersIn(t)) {
      expect(allowed.has(n), `"${n}" in "${t}" is not a registered fact`).toBe(true)
    }
  }
}

describe('templated summary generator', () => {
  const { summary, active } = runPipeline(client, NO_TOGGLES, seg, 2000, 3)

  it('never writes a number that is not in the simulation facts (grounding)', () => {
    assertGrounded(summary)
  })

  it('matches the UC1 output shape', () => {
    expect(summary.segment_id).toBe(11)
    expect(summary.horizon).toEqual({ current_age: 41, retirement_age: 65, end_age: 90 })
    expect(summary.simulation.runs).toBe(2000)
    expect(summary.simulation.kpis).toEqual(active.kpis)
    expect(summary.visualizations.map((v) => v.type)).toEqual(['fan_chart', 'outcome_distribution', 'goal_gauge'])
    expect(summary.highlights).toHaveLength(3)
    expect(summary.disclaimers).toHaveLength(3)
    expect(summary.source).toBe('templated')
  })

  it('headline carries the chance and the band tone', () => {
    const { money_lasts_pct, band } = active.kpis
    expect(summary.headline).toContain(`${money_lasts_pct}% chance your money lasts to 90`)
    const tone = band === 'Good' ? 'on track' : band === 'Borderline' ? 'close' : 'needs attention'
    expect(summary.headline).toContain(tone)
  })

  it('narrative is 2–4 sentences without toggles', () => {
    const sentences = summary.narrative.split(/(?<=[.!?])\s+/).filter(Boolean)
    expect(sentences.length).toBeGreaterThanOrEqual(2)
    expect(sentences.length).toBeLessThanOrEqual(4)
    expect(summary.scenario_delta).toBeNull()
  })

  it('explains the delta when a toggle is on, and stays grounded', () => {
    const toggled = runPipeline(client, { ...NO_TOGGLES, save_more: true }, seg, 2000, 3)
    const s = toggled.summary
    expect(s.scenario_delta).toContain('Save more')
    expect(s.scenario_delta).toContain(`${toggled.baseline.kpis.money_lasts_pct}%`)
    expect(s.scenario_delta).toContain(`${toggled.active.kpis.money_lasts_pct}%`)
    expect(s.narrative).toContain(s.scenario_delta!)
    assertGrounded(s)
  })

  it('grounding helper flags invented numbers and accepts formatted facts', () => {
    const f = summary.facts
    const sample = `about a ${f.money_lasts_pct}% chance, $${f.nw_at_retirement.toLocaleString('en-US')} at ${f.retirement_age} over ${f.runs.toLocaleString('en-US')} runs`
    expect(ungroundedNumbers(sample, f)).toEqual([])
    // 7.77 and 999,999,999 cannot be simulation facts for any segment.
    expect(ungroundedNumbers('roughly 7.77% chance and $999,999,999', summary.facts)).toEqual(['7.77', '999,999,999'])
  })

  it('stays grounded for at-risk and comfortably-funded clients too', () => {
    const atRisk = runPipeline({ ...client, monthly_expenses: 12_000 }, NO_TOGGLES, { id: 'custom', label: 'Custom' }, 1500, 5)
    expect(atRisk.active.kpis.band).toBe('At Risk')
    expect(atRisk.summary.headline).toContain('needs attention')
    assertGrounded(atRisk.summary)

    const funded = runPipeline({ ...client, net_worth: 3_000_000 }, NO_TOGGLES, seg, 1500, 5)
    expect(funded.active.kpis.band).toBe('Good')
    assertGrounded(funded.summary)
  })
})
