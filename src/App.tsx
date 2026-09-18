import { useEffect, useMemo, useState } from 'react'
import segmentsData from './data/segments.json'
import { ClientPanel } from './components/ClientPanel.tsx'
import { MobileFuture } from './components/MobileFuture.tsx'
import { runPipeline } from './engine/pipeline.ts'
import { DEFAULT_RUNS, DEFAULT_SEED } from './engine/monteCarlo.ts'
import { NO_TOGGLES } from './engine/scenarios.ts'
import { fetchLlmSummary, getLlmConfig, type LlmConfig } from './engine/llm.ts'
import type { ClientInputs, ScenarioToggles, Segment, SummaryOutput } from './engine/types.ts'

/**
 * SWAP-IN POINT #1 — segmentation. `segments.json` is a hand-made stand-in for the future ML
 * client-segmentation model (see docs/use-cases/uc1-ai-financial-summary.md §1). Replace this
 * import with a fetch of `segment_id + centroid profile` for the signed-in client.
 */
const SEGMENTS = segmentsData as Segment[]

export type SelectedId = number | 'custom'

const stripMeta = (s: Segment): ClientInputs => {
  const { id: _id, label: _label, persona: _persona, ...fields } = s
  return structuredClone(fields)
}

export default function App() {
  const [selectedId, setSelectedId] = useState<SelectedId>(SEGMENTS[10].id) // "Mid-career mortgage-heavy accumulator"
  const [client, setClient] = useState<ClientInputs>(() => stripMeta(SEGMENTS[10]))
  const [toggles, setToggles] = useState<ScenarioToggles>(NO_TOGGLES)
  const [runs, setRuns] = useState(DEFAULT_RUNS)
  const [seed, setSeed] = useState(DEFAULT_SEED)
  const [llm, setLlm] = useState<LlmConfig>({ llm_mode: 'templated', model: null })
  const [llmCopy, setLlmCopy] = useState<{ key: string; headline: string; narrative: string } | null>(null)
  const [llmPending, setLlmPending] = useState(false)

  useEffect(() => {
    getLlmConfig().then(setLlm)
  }, [])

  const segment = useMemo(() => SEGMENTS.find((s) => s.id === selectedId) ?? null, [selectedId])
  const edited = useMemo(() => (segment ? JSON.stringify(stripMeta(segment)) !== JSON.stringify(client) : false), [segment, client])

  // Every edit / toggle re-runs the real Monte Carlo (baseline + toggled + scenario readings + levers).
  const result = useMemo(
    () => runPipeline(client, toggles, { id: selectedId, label: segment?.label ?? 'Custom client' }, runs, seed),
    [client, toggles, selectedId, segment, runs, seed],
  )

  // Optional LLM rewrite of headline/narrative — keyed on the facts so stale responses are dropped.
  const factsKey = JSON.stringify(result.summary.facts)
  useEffect(() => {
    if (llm.llm_mode === 'templated') return
    const ctrl = new AbortController()
    setLlmPending(true)
    fetchLlmSummary(result.summary, ctrl.signal).then((copy) => {
      if (ctrl.signal.aborted) return
      if (copy) setLlmCopy({ key: factsKey, ...copy })
      setLlmPending(false)
    })
    return () => ctrl.abort()
  }, [llm.llm_mode, factsKey, result.summary])

  const summary: SummaryOutput =
    llm.llm_mode !== 'templated' && llmCopy?.key === factsKey
      ? { ...result.summary, headline: llmCopy.headline, narrative: llmCopy.narrative, source: llm.llm_mode }
      : result.summary

  const selectSegment = (id: SelectedId) => {
    setSelectedId(id)
    if (id !== 'custom') {
      const s = SEGMENTS.find((x) => x.id === id)!
      setClient(stripMeta(s))
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Tangerine Wealth · UC1 demo</div>
          <h1>AI “Future Outlook” summary</h1>
          <p className="muted">
            A real Monte Carlo runs client-side on every change; the summary is generated from its numbers.
            Summary mode:{' '}
            <strong>
              {llm.llm_mode === 'templated'
                ? 'templated (offline)'
                : `${llm.llm_mode === 'gemini' ? 'Gemini on Vertex AI' : 'OpenAI'} (${llm.model})`}
            </strong>
            .
          </p>
        </div>
      </header>

      <main className="columns">
        <ClientPanel
          segments={SEGMENTS}
          selectedId={selectedId}
          onSelect={selectSegment}
          client={client}
          onChange={setClient}
          edited={edited}
          onReset={() => segment && setClient(stripMeta(segment))}
          runs={runs}
          onRuns={setRuns}
          seed={seed}
          onSeed={setSeed}
        />
        <MobileFuture
          result={result}
          summary={summary}
          toggles={toggles}
          onToggles={setToggles}
          llmPending={llm.llm_mode !== 'templated' && llmPending && summary.source === 'templated'}
          llmMode={llm.llm_mode}
        />
      </main>
    </div>
  )
}
