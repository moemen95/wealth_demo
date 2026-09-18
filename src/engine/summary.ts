import { fmtInt, fmtMoney } from './format.ts'
import { SCENARIO } from './scenarios.ts'
import type { Band, Grounding, Highlight, ScenarioToggles, SimResult, SummaryOutput } from './types.ts'

/** Everything the templated generator needs. All sims are run by the pipeline; this module only writes copy. */
export interface SummaryContext {
  segment_id: number | 'custom'
  segment_label: string
  /** Simulation with NO toggles applied. */
  baseline: SimResult
  /** Simulation with the active toggles applied (=== baseline when none are on). */
  active: SimResult
  toggles: ScenarioToggles
  /** Each single quick-scenario toggle applied to the baseline, one at a time. */
  readings: Record<keyof ScenarioToggles, SimResult>
  /** Positive levers applied to the baseline (save_more is reused from readings). */
  levers: { retire_later: SimResult; cut_spend: SimResult }
}

export const GUARDRAILS = [
  'Shown in today’s dollars.',
  'Taxes not modelled.',
  'General information, not advice.',
]

const GOAL = 90

/**
 * Deterministic, templated summary. Every number in the copy is registered in `facts` first via
 * `use()`, which is what lets the grounding tests prove the narrative never invents a figure.
 */
export function generateSummary(ctx: SummaryContext): SummaryOutput {
  const { active, baseline, toggles, readings, levers } = ctx
  const facts: Record<string, number> = {}
  const use = (key: string, value: number): number => {
    facts[key] = value
    return value
  }

  const k = active.kpis
  const inp = active.inputs
  const pct = use('money_lasts_pct', k.money_lasts_pct)
  const end = use('end_age', inp.end_age)
  const ret = use('retirement_age', inp.retirement_age)
  const runs = use('runs', active.runs)
  const nwRet = use('nw_at_retirement', k.nw_at_retirement)
  const nwEnd = use('nw_at_end', k.nw_at_end)
  const spend = use('annual_spend', inp.annual_spend)
  const retPoint = active.series.find((s) => s.age === Math.min(Math.max(ret, inp.current_age), end))
  const p25Ret = use('p25_at_retirement', Math.round(retPoint?.p25 ?? 0))
  const p75Ret = use('p75_at_retirement', Math.round(retPoint?.p75 ?? 0))
  const goal = use('goal_pct', GOAL)

  // ---- Headline (tone varies by band) ----
  const band: Band = k.band
  const chance = `${pct}% chance your money lasts to ${end}`
  const headline =
    band === 'Good'
      ? `You’re on track — about a ${chance}.`
      : band === 'Borderline'
        ? `You’re close — about a ${chance}.`
        : `Your plan needs attention — about a ${chance}.`

  // ---- Narrative: 2–4 sentences ----
  const s1 = `Based on ${fmtInt(runs)} simulations of your current plan, your net worth at retirement (age ${ret}) lands around ${fmtMoney(nwRet)} in today’s dollars, with a typical range of ${fmtMoney(p25Ret)}–${fmtMoney(p75Ret)}.`

  let s2: string
  if (band === 'Good') {
    const above = use('points_above_goal', pct - goal)
    s2 =
      `In ${pct}% of scenarios your savings still cover ${fmtMoney(spend)} a year of spending through age ${end}, and the middle path leaves about ${fmtMoney(nwEnd)} at ${end}. ` +
      (above >= 5 ? `That’s comfortably above the ${goal}% goal.` : `That clears the ${goal}% goal.`)
  } else {
    const shortRuns = use('scenarios_run_out_pct', 100 - pct)
    const shortPts = use('points_below_goal', goal - pct)
    const runsOut = k.median_runs_out_age
    if (runsOut !== null) {
      use('median_runs_out_age', runsOut)
      s2 = `In ${shortRuns}% of scenarios the money runs out before ${end} at ${fmtMoney(spend)} a year of spending — on the middle path it runs out around age ${runsOut}, ${shortPts} points short of the ${goal}% goal.`
    } else {
      s2 = `In ${shortRuns}% of scenarios the money runs out before ${end} at ${fmtMoney(spend)} a year of spending — ${shortPts} points short of the ${goal}% goal.`
    }
  }

  // ---- Biggest lever (evaluated on the baseline, so it doesn't double-count an active toggle) ----
  const basePct = use('baseline_money_lasts_pct', baseline.kpis.money_lasts_pct)
  const saveMonthly = use('save_more_monthly', SCENARIO.save_more_monthly)
  const leverYears = use('lever_years', SCENARIO.retire_earlier_years)
  const cutPct = use('cut_spend_pct', 10)
  const candidates: { name: string; detail: string; pct: number }[] = [
    { name: 'contributions', detail: `adding $${saveMonthly} a month`, pct: readings.save_more.kpis.money_lasts_pct },
    { name: 'retirement timing', detail: `working ${leverYears} more years`, pct: levers.retire_later.kpis.money_lasts_pct },
    { name: 'spending', detail: `trimming spending by ${cutPct}%`, pct: levers.cut_spend.kpis.money_lasts_pct },
  ]
  const best = candidates.reduce((a, b) => (b.pct > a.pct ? b : a))
  const bestPct = use('lever_money_lasts_pct', best.pct)
  const bestDelta = use('lever_delta_pts', best.pct - basePct)
  const s3 =
    bestDelta > 0
      ? `The biggest lever is ${best.name}: ${best.detail} would move your chance to about ${bestPct}%.`
      : `Your plan is already at the ceiling — even ${best.detail} keeps the chance around ${bestPct}%.`

  // ---- Scenario delta vs. untoggled baseline ----
  const activeNames = (Object.keys(toggles) as (keyof ScenarioToggles)[]).filter((t) => toggles[t])
  const NAMES: Record<keyof ScenarioToggles, string> = {
    save_more: 'Save more',
    retire_earlier: 'Retire earlier',
    live_longer: 'Live longer',
    market_downturn: 'Market downturn',
  }
  const scenario_delta =
    activeNames.length > 0
      ? `With ${activeNames.map((n) => NAMES[n]).join(' + ')} applied, your chance moved from ${basePct}% to ${pct}%.`
      : null

  const narrative = [s1, s2, s3, scenario_delta].filter(Boolean).join(' ')

  // ---- Scenario readings (each toggle alone, on the baseline) ----
  const verb = (p: number) => (p > basePct ? 'raises' : p < basePct ? 'lowers' : 'keeps')
  const rSave = use('reading_save_more_pct', readings.save_more.kpis.money_lasts_pct)
  const rRetire = use('reading_retire_earlier_pct', readings.retire_earlier.kpis.money_lasts_pct)
  const rLive = use('reading_live_longer_pct', readings.live_longer.kpis.money_lasts_pct)
  const rDown = use('reading_market_downturn_pct', readings.market_downturn.kpis.money_lasts_pct)
  const liveTo = use('live_longer_end_age', baseline.inputs.end_age + SCENARIO.live_longer_years)
  const earlierYears = use('retire_earlier_years', SCENARIO.retire_earlier_years)
  const scenario_readings = {
    save_more: `Adding $${saveMonthly} a month ${verb(rSave)} the chance to about ${rSave}%.`,
    retire_earlier: `Retiring ${earlierYears} years earlier ${verb(rRetire)} it to about ${rRetire}%.`,
    live_longer: `Planning to ${liveTo} ${verb(rLive)} it to about ${rLive}%.`,
    market_downturn: `A market downturn ${verb(rDown)} it to about ${rDown}%.`,
  }

  // ---- Highlights (chips) ----
  const nw65Age = use('nw_highlight_age', Math.min(Math.max(65, inp.current_age), end))
  const nw65 = use('nw_at_65', k.nw_at_65)
  const highlights: Highlight[] = [
    { label: 'Chance money lasts', value: `${pct}%`, band },
    { label: `Projected net worth at ${nw65Age}`, value: fmtMoney(nw65) },
    {
      label: 'Biggest lever',
      value: best.name.charAt(0).toUpperCase() + best.name.slice(1),
      detail: bestDelta > 0 ? `${best.detail} → ~+${bestDelta} pts` : `${best.detail} → ~${bestPct}%`,
    },
  ]

  // ---- "Why?" grounding ----
  const realPct = use('real_return_pct', Math.round(active.real_return * 1000) / 10)
  const volPct = use('volatility_pct', Math.round(inp.return_volatility * 1000) / 10)
  const contrib = use('annual_contribution', inp.annual_contribution)
  const startNw = use('starting_net_worth', inp.starting_net_worth)
  const yearsToRet = use('years_to_retirement', Math.max(0, ret - inp.current_age))
  const retLen = use('retirement_years', Math.max(0, end - ret))
  const why: Grounding[] = [
    { label: 'Starting net worth', value: fmtMoney(startNw) },
    { label: 'Annual contributions', value: `${fmtMoney(contrib)} for ${yearsToRet} years` },
    { label: 'Annual spending in retirement', value: `${fmtMoney(spend)} for ${retLen} years` },
    { label: 'Real return assumption', value: `${realPct}% mean, ${volPct}% volatility (today’s dollars)` },
    { label: 'Simulations', value: `${fmtInt(runs)} paths, seed ${use('seed', active.seed)}` },
    { label: 'Median net worth at retirement', value: fmtMoney(nwRet) },
    { label: 'Median net worth at end age', value: fmtMoney(nwEnd) },
    ...(k.withdrawal_rate_pct !== null
      ? [{ label: 'Withdrawal starting rate', value: `${use('withdrawal_rate_pct', k.withdrawal_rate_pct)}%` }]
      : []),
  ]

  return {
    segment_id: ctx.segment_id,
    segment_label: ctx.segment_label,
    horizon: { current_age: inp.current_age, retirement_age: ret, end_age: end },
    simulation: { runs, series: active.series, kpis: k },
    headline,
    narrative,
    highlights,
    visualizations: [
      { type: 'fan_chart', series_ref: 'simulation.series' },
      { type: 'outcome_distribution', metric: 'ending_net_worth' },
      { type: 'goal_gauge', target: goal, current: pct },
    ],
    scenario_readings,
    scenario_delta,
    why,
    disclaimers: GUARDRAILS,
    facts,
    source: 'templated',
  }
}
