import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtMoneyShort } from '../engine/format.ts'

/** Histogram of every run's ending net worth (capped at the 95th percentile so a few outliers don't flatten it). */
export function OutcomeDistribution({ endingBalances, bins = 12 }: { endingBalances: Float64Array; bins?: number }) {
  const sorted = Array.from(endingBalances).sort((a, b) => a - b)
  const n = sorted.length
  if (n === 0) return null
  const cap = sorted[Math.floor((n - 1) * 0.95)] || 1
  const width = cap / bins
  const counts = new Array(bins).fill(0)
  let zeros = 0
  for (const v of sorted) {
    if (v <= 0) zeros++
    counts[Math.min(bins - 1, Math.floor(v / width))]++
  }
  const data = counts.map((c, i) => ({
    label: i === bins - 1 ? `${fmtMoneyShort(i * width)}+` : fmtMoneyShort(i * width),
    pct: Math.round((c / n) * 1000) / 10,
    ruined: i === 0,
  }))

  return (
    <div className="dist">
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap={2}>
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#8a8a8a' }} tickLine={false} axisLine={false} interval={2} />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="tip">
                  <div className="tip-title">Ending net worth ≈ {String(payload[0].payload.label)}</div>
                  <div>{String(payload[0].payload.pct)}% of paths</div>
                </div>
              ) : null
            }
          />
          <Bar dataKey="pct" fill="#F26E21" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <div className="muted small">
        {Math.round((zeros / n) * 100)}% of paths end at $0 · {100 - Math.round((zeros / n) * 100)}% still have money at end age
      </div>
    </div>
  )
}
