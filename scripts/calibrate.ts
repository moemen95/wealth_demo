/**
 * Prints the badge each of the 30 segments lands on, so the seed data can be tuned to cover
 * on-track / borderline / at-risk. Run: `npm run calibrate` (Node ≥ 22.6 strips the types natively).
 */
import { readFileSync } from 'node:fs'
import { simulate, toSimInputs } from '../src/engine/monteCarlo.ts'
import type { Segment } from '../src/engine/types.ts'

const segments = JSON.parse(readFileSync(new URL('../src/data/segments.json', import.meta.url), 'utf8')) as Segment[]
const counts = { Good: 0, Borderline: 0, 'At Risk': 0 }
console.log('id  persona  band        pct   nw@ret        label')
for (const s of segments) {
  const r = simulate(toSimInputs(s, 5000, 42))
  counts[r.kpis.band]++
  console.log(
    String(s.id).padEnd(3),
    s.persona.padEnd(8),
    r.kpis.band.padEnd(11),
    `${r.kpis.money_lasts_pct}%`.padStart(4),
    `$${r.kpis.nw_at_retirement.toLocaleString('en-US')}`.padStart(13),
    s.label,
  )
}
console.log('\nbands:', counts)
