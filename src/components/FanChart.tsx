import { Area, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtMoneyShort } from '../engine/format.ts'
import type { SeriesPoint } from '../engine/types.ts'

interface Props {
  series: SeriesPoint[]
  retirementAge: number
  endAge: number
}

/**
 * Fan chart: outer band P10–P90, inner band P25–P75, dashed median, retirement marker and
 * decumulation shading. Recharts <Area> renders a band when its dataKey resolves to [low, high].
 */
export function FanChart({ series, retirementAge, endAge }: Props) {
  const data = series.map((p) => ({ ...p, outer: [p.p10, p.p90], inner: [p.p25, p.p75] }))
  const first = series[0]?.age ?? 0
  const ticks: number[] = []
  for (let a = Math.ceil(first / 10) * 10; a <= endAge; a += 10) ticks.push(a)

  return (
    <div className="fan">
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis dataKey="age" type="number" domain={[first, endAge]} ticks={ticks} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8a8a8a' }} />
          <YAxis hide domain={[0, 'auto']} />
          <ReferenceArea x1={retirementAge} x2={endAge} fill="#000" fillOpacity={0.035} />
          <Area type="monotone" dataKey="outer" stroke="none" fill="#7BC47F" fillOpacity={0.28} isAnimationActive={false} />
          <Area type="monotone" dataKey="inner" stroke="none" fill="#3E9F4A" fillOpacity={0.35} isAnimationActive={false} />
          <Line type="monotone" dataKey="p50" stroke="#1E6E2A" strokeWidth={1.6} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          <ReferenceLine x={retirementAge} stroke="#9a9a9a" strokeDasharray="2 3" />
          <Tooltip
            cursor={{ stroke: '#F26E21', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as SeriesPoint
              return (
                <div className="tip">
                  <div className="tip-title">Age {p.age}{p.age === retirementAge ? ' · retirement' : ''}</div>
                  <div><span>P90</span>{fmtMoneyShort(p.p90)}</div>
                  <div><span>P50</span><strong>{fmtMoneyShort(p.p50)}</strong></div>
                  <div><span>P10</span>{fmtMoneyShort(p.p10)}</div>
                </div>
              )
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="fan-legend">
        <span><i className="sw outer" /> 10–90%</span>
        <span><i className="sw inner" /> 25–75%</span>
        <span><i className="sw median" /> median</span>
        <span className="muted">shaded = retirement</span>
      </div>
    </div>
  )
}
