import { TOGGLE_LABELS } from '../engine/scenarios.ts'
import type { ScenarioToggles } from '../engine/types.ts'

interface Props {
  toggles: ScenarioToggles
  onChange: (t: ScenarioToggles) => void
}

export function ScenarioTogglesCard({ toggles, onChange }: Props) {
  const keys = Object.keys(TOGGLE_LABELS) as (keyof ScenarioToggles)[]
  return (
    <>
      <div className="section-label">Quick scenarios</div>
      <div className="card toggles">
        {keys.map((k) => (
          <label key={k} className={`toggle-row ${k === 'market_downturn' ? 'stress' : ''}`}>
            <span>
              <span className="toggle-title">
                {TOGGLE_LABELS[k].title} <i className="info">i</i>
              </span>
              <span className="toggle-caption">{TOGGLE_LABELS[k].caption}</span>
            </span>
            <span className={`switch ${toggles[k] ? 'on' : ''}`}>
              <input type="checkbox" checked={toggles[k]} onChange={(e) => onChange({ ...toggles, [k]: e.target.checked })} />
              <span className="knob" />
            </span>
          </label>
        ))}
      </div>
    </>
  )
}
