import { useState } from 'react'
import type { PipelineResult } from '../engine/pipeline.ts'
import { fmtMoney } from '../engine/format.ts'
import type { ScenarioToggles, SummaryOutput } from '../engine/types.ts'
import { AiSummaryCard } from './AiSummaryCard.tsx'
import { FanChart } from './FanChart.tsx'
import { GoalGauge } from './GoalGauge.tsx'
import { OutcomeDistribution } from './OutcomeDistribution.tsx'
import { ScenarioTogglesCard } from './ScenarioToggles.tsx'

interface Props {
  result: PipelineResult
  summary: SummaryOutput
  toggles: ScenarioToggles
  onToggles: (t: ScenarioToggles) => void
}

const bandClass = (b: string) => (b === 'Good' ? 'good' : b === 'Borderline' ? 'borderline' : 'risk')

export function MobileFuture({ result, summary, toggles, onToggles }: Props) {
  const [more, setMore] = useState(false)
  const { active } = result
  const k = active.kpis
  const { retirement_age, end_age } = active.inputs

  return (
    <section className="phone-col">
      <div className="phone">
        <div className="status-bar">
          <span>9:41</span>
          <span className="status-icons">▮▮▮ ᯤ ▮</span>
        </div>
        <div className="app-header">
          <span className="app-title">Plan</span>
          <span className="app-menu">···</span>
        </div>
        <div className="segmented">
          <span>My Net Worth</span>
          <span className="active">My Future</span>
        </div>

        <div className="screen">
          <div className="hero">
            <div className="hero-label">Retirement at {retirement_age}</div>
            <div className="hero-value">{fmtMoney(k.nw_at_retirement)}</div>
            <div className="hero-sub">Legacy at {end_age}: {fmtMoney(k.nw_at_end)}</div>
          </div>

          <FanChart series={active.series} retirementAge={retirement_age} endAge={end_age} />

          <div className={`kpi-banner ${bandClass(k.band)}`}>
            <div>
              <div className="kpi-value">{k.money_lasts_pct}%</div>
              <div className="kpi-label">Chance money lasts</div>
            </div>
            <span className={`badge ${bandClass(k.band)}`}>{k.band}</span>
          </div>

          <AiSummaryCard summary={summary} />

          <ScenarioTogglesCard toggles={toggles} onChange={onToggles} />

          <div className="card">
            <button className="link-btn" onClick={() => setMore((m) => !m)}>
              {more ? 'See less' : 'See more'} <span className="chev">{more ? '▴' : '▾'}</span>
            </button>
            {more && (
              <div className="more">
                <div className="card-title">Where the {active.runs.toLocaleString('en-US')} paths end up</div>
                <OutcomeDistribution endingBalances={active.ending_balances} />
                <div className="card-title">Goal: 90% chance money lasts</div>
                <GoalGauge current={k.money_lasts_pct} target={90} band={k.band} />
              </div>
            )}
          </div>

          <div className="disclaimers">
            {summary.disclaimers.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </div>

        <nav className="bottom-nav">
          {['Home', 'Transfer', 'Invest', 'Plan', 'More'].map((n) => (
            <span key={n} className={n === 'Plan' ? 'active' : ''}>
              <i>{n === 'Home' ? '⌂' : n === 'Transfer' ? '⇄' : n === 'Invest' ? '⫶' : n === 'Plan' ? '◔' : '···'}</i>
              {n}
            </span>
          ))}
        </nav>
      </div>
    </section>
  )
}
