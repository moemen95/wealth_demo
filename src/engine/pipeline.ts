import { DEFAULT_RUNS, DEFAULT_SEED, simulate, toSimInputs } from './monteCarlo.ts'
import { NO_TOGGLES, SCENARIO, applyToggles } from './scenarios.ts'
import { generateSummary, type SummaryContext } from './summary.ts'
import type { ClientInputs, ScenarioToggles, SimResult, SummaryOutput } from './types.ts'

export interface PipelineResult {
  baseline: SimResult
  active: SimResult
  summary: SummaryOutput
}

/**
 * The whole UC1 pipeline for one client: baseline sim → toggled sim → one sim per quick scenario
 * → lever sims → templated summary. Pure; the React layer just memoizes a call to this.
 */
export function runPipeline(
  client: ClientInputs,
  toggles: ScenarioToggles,
  segment: { id: number | 'custom'; label: string },
  runs = DEFAULT_RUNS,
  seed = DEFAULT_SEED,
): PipelineResult {
  const base = toSimInputs(client, runs, seed)
  const baseline = simulate(base)
  const anyToggle = Object.values(toggles).some(Boolean)
  const active = anyToggle ? simulate(applyToggles(base, toggles)) : baseline

  const one = (key: keyof ScenarioToggles) => simulate(applyToggles(base, { ...NO_TOGGLES, [key]: true }))
  const readings: SummaryContext['readings'] = {
    save_more: one('save_more'),
    retire_earlier: one('retire_earlier'),
    live_longer: one('live_longer'),
    market_downturn: one('market_downturn'),
  }
  const levers: SummaryContext['levers'] = {
    retire_later: simulate({
      ...base,
      retirement_age: Math.min(base.end_age - 1, base.retirement_age + SCENARIO.retire_earlier_years),
    }),
    cut_spend: simulate({ ...base, annual_spend: base.annual_spend * 0.9 }),
  }

  const summary = generateSummary({
    segment_id: segment.id,
    segment_label: segment.label,
    baseline,
    active,
    toggles,
    readings,
    levers,
  })
  return { baseline, active, summary }
}
