import type { Band } from '../engine/types.ts'

const COLOR: Record<Band, string> = { Good: '#2E7D32', Borderline: '#E68A00', 'At Risk': '#C62828' }

/** Semicircular gauge: filled arc = current "chance money lasts", tick = the 90% target. */
export function GoalGauge({ current, target, band }: { current: number; target: number; band: Band }) {
  const r = 70
  const cx = 90
  const cy = 85
  const arc = (pct: number) => {
    const a = Math.PI * (1 - pct / 100)
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }
  }
  const end = arc(current)
  const tick = arc(target)
  const large = current > 50 ? 1 : 0
  return (
    <div className="gauge">
      <svg viewBox="0 0 180 100" width="100%" height="110">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke="#eee" strokeWidth="14" fill="none" strokeLinecap="round" />
        {current > 0 && (
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`} stroke={COLOR[band]} strokeWidth="14" fill="none" strokeLinecap="round" />
        )}
        <line x1={tick.x} y1={tick.y} x2={cx + (tick.x - cx) * 0.78} y2={cy - (cy - tick.y) * 0.78} stroke="#333" strokeWidth="2.5" />
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="26" fontWeight="700" fill="#1a1a1a">
          {current}%
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="10" fill="#8a8a8a">
          target {target}%
        </text>
      </svg>
      <div className="muted small">
        {current >= target ? `${current - target} points above the goal` : `${target - current} points to go`}
      </div>
    </div>
  )
}
