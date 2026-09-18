import type { SummaryOutput } from './types.ts'
import { GUARDRAILS } from './summary.ts'

export type LlmMode = 'templated' | 'openai' | 'gemini'

export interface LlmConfig {
  llm_mode: LlmMode
  model: string | null
}

/** Ask the dev server which mode it's in (never exposes the key). Falls back to templated. */
export async function getLlmConfig(): Promise<LlmConfig> {
  try {
    const r = await fetch('/api/config')
    if (!r.ok) throw new Error(String(r.status))
    return (await r.json()) as LlmConfig
  } catch {
    return { llm_mode: 'templated', model: null }
  }
}

/**
 * Optional real-LLM rewrite of the headline + narrative. The LLM only ever sees `facts`
 * (the numbers the templated generator was allowed to use) plus the guardrails, and must
 * return the same shape. Anything malformed ⇒ null, and the caller keeps the templated copy.
 */
export async function fetchLlmSummary(
  summary: SummaryOutput,
  signal?: AbortSignal,
): Promise<Pick<SummaryOutput, 'headline' | 'narrative'> | null> {
  try {
    const r = await fetch('/api/summary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({
        facts: { ...summary.facts, band: summary.simulation.kpis.band, segment_label: summary.segment_label },
        guardrails: GUARDRAILS,
        shape: { headline: 'one sentence, ends with the chance money lasts', narrative: '2-4 sentences' },
      }),
    })
    if (!r.ok) return null
    const data = (await r.json()) as Partial<Pick<SummaryOutput, 'headline' | 'narrative'>>
    if (typeof data.headline !== 'string' || typeof data.narrative !== 'string') return null
    return { headline: data.headline, narrative: data.narrative }
  } catch {
    return null
  }
}
