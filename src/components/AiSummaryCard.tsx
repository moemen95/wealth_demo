import { useState } from 'react'
import type { SummaryOutput } from '../engine/types.ts'

const bandClass = (b?: string) => (b === 'Good' ? 'good' : b === 'Borderline' ? 'borderline' : b === 'At Risk' ? 'risk' : '')

interface Props {
  summary: SummaryOutput
  pending?: boolean
  pendingProvider?: string
}

const providerName = (p: string) => (p === 'gemini' ? 'Gemini' : p === 'openai' ? 'OpenAI' : p)

export function AiSummaryCard({ summary, pending = false, pendingProvider = '' }: Props) {
  const [open, setOpen] = useState(true)
  const [why, setWhy] = useState(false)
  const band = summary.simulation.kpis.band

  return (
    <div className="card ai-card">
      <button className="ai-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="ai-spark">✦</span>
        <span className="ai-headline">{summary.headline}</span>
        <span className={`badge sm ${bandClass(band)}`}>{band}</span>
        <span className="chev">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="ai-body">
          <p className="ai-narrative">{summary.narrative}</p>

          <div className="chips">
            {summary.highlights.map((h) => (
              <div key={h.label} className={`chip ${bandClass(h.band)}`}>
                <div className="chip-label">{h.label}</div>
                <div className="chip-value">{h.value}</div>
                {h.detail && <div className="chip-detail">{h.detail}</div>}
              </div>
            ))}
          </div>

          <div className="readings">
            {Object.values(summary.scenario_readings).map((r) => (
              <div key={r}>· {r}</div>
            ))}
          </div>

          <button className="link-btn" onClick={() => setWhy((w) => !w)}>
            Why? <span className="chev">{why ? '▴' : '▾'}</span>
          </button>
          {why && (
            <dl className="why">
              {summary.why.map((g) => (
                <div key={g.label}>
                  <dt>{g.label}</dt>
                  <dd>{g.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="ai-foot">
            AI summary ·{' '}
            {summary.source === 'templated'
              ? 'templated from simulation'
              : `${providerName(summary.source)} over simulation facts`}{' '}
            · {summary.segment_label}
            {pending && <span className="ai-pending"> · refining with {providerName(pendingProvider)}…</span>}
          </div>
        </div>
      )}
    </div>
  )
}
