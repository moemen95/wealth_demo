import type { SummaryOutput } from './types.ts'
import { GUARDRAILS } from './summary.ts'
import { ungroundedNumbers } from './grounding.ts'

export type LlmMode = 'templated' | 'openai' | 'gemini'

export interface LlmConfig {
  llm_mode: LlmMode
  model: string | null
}

/** Ask the server which mode it's in (never exposes credentials). Falls back to templated. */
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
 * Optional real-LLM rewrite of the headline + narrative.
 *
 * The LLM gets the templated draft (already correct and grounded) plus the `facts` whitelist and the
 * guardrails, and is asked to rewrite for warmth/clarity without changing a number. The reply is
 * verified here with the same grounding check the tests use: if it contains ANY number that is not a
 * registered fact it is discarded and the templated copy stays. Malformed/failed ⇒ null, same effect.
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
        draft: { headline: summary.headline, narrative: summary.narrative },
        guardrails: GUARDRAILS,
        shape: { headline: 'one sentence, must include the chance money lasts and the end age', narrative: '2-4 sentences' },
      }),
    })
    if (!r.ok) return null
    const data = (await r.json()) as Partial<Pick<SummaryOutput, 'headline' | 'narrative'>>
    if (typeof data.headline !== 'string' || typeof data.narrative !== 'string') return null
    const bad = ungroundedNumbers(data.headline + ' ' + data.narrative, summary.facts)
    if (bad.length > 0) {
      console.warn('[llm] discarding reply with un-grounded numbers:', bad)
      return null
    }
    return { headline: data.headline, narrative: data.narrative }
  } catch {
    return null
  }
}
