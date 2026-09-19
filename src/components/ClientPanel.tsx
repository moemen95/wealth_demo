import type { SelectedId } from '../App.tsx'
import type { ClientInputs, RiskProfile, Segment } from '../engine/types.ts'

const RISK_PRESETS: Record<RiskProfile, { expected_return: number; return_volatility: number; mix: ClientInputs['asset_mix'] }> = {
  Conservative: { expected_return: 4.0, return_volatility: 6.0, mix: { equity: 30, fixed_income: 55, cash: 15 } },
  Balanced: { expected_return: 5.5, return_volatility: 9.0, mix: { equity: 55, fixed_income: 35, cash: 10 } },
  Growth: { expected_return: 7.0, return_volatility: 13.0, mix: { equity: 75, fixed_income: 20, cash: 5 } },
  Aggressive: { expected_return: 8.0, return_volatility: 17.0, mix: { equity: 90, fixed_income: 8, cash: 2 } },
}

interface Props {
  segments: Segment[]
  selectedId: SelectedId
  onSelect: (id: SelectedId) => void
  client: ClientInputs
  onChange: (c: ClientInputs) => void
  /** Form differs from what has been submitted/simulated. */
  dirty: boolean
  /** A simulation or summary is in flight. */
  running: boolean
  onSubmit: () => void
  onDiscard: () => void
  /** Submitted values differ from the selected segment's defaults. */
  edited: boolean
  onReset: () => void
  runs: number
  onRuns: (n: number) => void
  seed: number
  onSeed: (n: number) => void
}

type NumKey = Exclude<keyof ClientInputs, 'asset_mix' | 'risk_profile'>

export function ClientPanel({ segments, selectedId, onSelect, client, onChange, dirty, running, onSubmit, onDiscard, edited, onReset, runs, onRuns, seed, onSeed }: Props) {
  const set = (key: NumKey, raw: string) => {
    const v = Number(raw)
    if (Number.isNaN(v)) return
    const next: ClientInputs = { ...client, [key]: v }
    // Keep the accounting identity net worth = assets − liabilities whichever side is edited.
    if (key === 'total_assets' || key === 'total_liabilities') next.net_worth = next.total_assets - next.total_liabilities
    if (key === 'net_worth') next.total_assets = v + next.total_liabilities
    if (key === 'total_liabilities' && next.debt > v) next.debt = v
    onChange(next)
  }
  const setMix = (k: keyof ClientInputs['asset_mix'], raw: string) => {
    const v = Number(raw)
    if (!Number.isNaN(v)) onChange({ ...client, asset_mix: { ...client.asset_mix, [k]: v } })
  }
  const setRisk = (rp: RiskProfile) => {
    const p = RISK_PRESETS[rp]
    onChange({ ...client, risk_profile: rp, expected_return: p.expected_return, return_volatility: p.return_volatility, asset_mix: { ...p.mix } })
  }

  const Field = ({ label, k, step = 1, min, suffix }: { label: string; k: NumKey; step?: number; min?: number; suffix?: string }) => (
    <label className="field">
      <span>{label}</span>
      <span className="input-wrap">
        <input type="number" value={client[k]} step={step} min={min} onChange={(e) => set(k, e.target.value)} />
        {suffix && <em>{suffix}</em>}
      </span>
    </label>
  )

  const mixTotal = client.asset_mix.equity + client.asset_mix.fixed_income + client.asset_mix.cash

  return (
    <form
      className="panel"
      noValidate // numbers are validated by the engine; native step/min checks would silently block submit
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <h2>Client / Persona</h2>
      <label className="field">
        <span>Segment</span>
        <select value={String(selectedId)} onChange={(e) => onSelect(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}>
          {(['Elena', 'Elijah', 'Esme'] as const).map((persona) => (
            <optgroup key={persona} label={`${persona} — ${persona === 'Elena' ? 'emerging $0–100K' : persona === 'Elijah' ? 'switcher $100–500K' : 'mass-affluent $500K–1MM+'}`}>
              {segments
                .filter((s) => s.persona === persona)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}. {s.label}
                  </option>
                ))}
            </optgroup>
          ))}
          <optgroup label="—">
            <option value="custom">Custom (edit everything)</option>
          </optgroup>
        </select>
      </label>
      {edited && !dirty && (
        <div className="edited-note">
          Edited from segment defaults.{' '}
          <button type="button" onClick={onReset}>
            Reset
          </button>
        </div>
      )}
      {dirty && (
        <div className="edited-note dirty">
          Unsubmitted changes — press <strong>Run outlook</strong> (or Enter).
          <button type="button" onClick={onDiscard}>
            Discard
          </button>
        </div>
      )}

      <h3>Profile</h3>
      <div className="grid2">
        <Field label="Age" k="age" min={18} />
        <Field label="Retirement age" k="retirement_age" min={19} />
        <Field label="Life expectancy" k="life_expectancy" min={20} />
        <Field label="Annual income" k="annual_income" step={1000} suffix="$/yr" />
      </div>

      <h3>Balance sheet</h3>
      <div className="grid2">
        <Field label="Total assets" k="total_assets" step={1000} suffix="$" />
        <Field label="Total liabilities" k="total_liabilities" step={1000} min={0} suffix="$" />
        <Field label="Net worth" k="net_worth" step={1000} suffix="$" />
        <Field label="…of which debt" k="debt" step={1000} min={0} suffix="$" />
      </div>

      <h3>Cash flow</h3>
      <div className="grid2">
        <Field label="Monthly contributions" k="monthly_contributions" step={50} min={0} suffix="$/mo" />
        <Field label="Monthly expenses" k="monthly_expenses" step={50} min={0} suffix="$/mo" />
      </div>

      <h3>Investments</h3>
      <label className="field">
        <span>Risk profile</span>
        <select value={client.risk_profile} onChange={(e) => setRisk(e.target.value as RiskProfile)}>
          {Object.keys(RISK_PRESETS).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <div className="grid3">
        <label className="field">
          <span>Equity %</span>
          <input type="number" value={client.asset_mix.equity} onChange={(e) => setMix('equity', e.target.value)} />
        </label>
        <label className="field">
          <span>Fixed inc. %</span>
          <input type="number" value={client.asset_mix.fixed_income} onChange={(e) => setMix('fixed_income', e.target.value)} />
        </label>
        <label className="field">
          <span>Cash %</span>
          <input type="number" value={client.asset_mix.cash} onChange={(e) => setMix('cash', e.target.value)} />
        </label>
      </div>
      {mixTotal !== 100 && <div className="warn">Asset mix sums to {mixTotal}% (informational only — the engine uses the return/volatility below).</div>}
      <div className="grid3">
        <Field label="Expected return" k="expected_return" step={0.1} suffix="%" />
        <Field label="Volatility" k="return_volatility" step={0.5} min={0} suffix="%" />
        <Field label="Inflation" k="inflation" step={0.1} suffix="%" />
      </div>

      <div className="submit-row">
        <button type="submit" className="primary" disabled={!dirty || running}>
          {running ? (
            <>
              <i className="spinner light" /> Running…
            </>
          ) : dirty ? (
            'Run outlook'
          ) : (
            'Outlook is up to date'
          )}
        </button>
      </div>

      <details className="dev">
        <summary>Dev controls (apply immediately)</summary>
        <div className="grid2">
          <label className="field">
            <span>Runs</span>
            <input type="number" value={runs} step={100} min={100} max={20000} onChange={(e) => onRuns(Math.max(100, Number(e.target.value) || 100))} />
          </label>
          <label className="field">
            <span>Seed</span>
            <input type="number" value={seed} onChange={(e) => onSeed(Number(e.target.value) || 0)} />
          </label>
        </div>
        <p className="muted small">
          Real return = expected − inflation; sampled per year from Normal(mean, volatility). Same seed ⇒ identical paths.
        </p>
      </details>
    </form>
  )
}
