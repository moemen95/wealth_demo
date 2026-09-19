import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import segmentsData from './data/segments.json'
import { ClientPanel } from './components/ClientPanel.tsx'
import { MobileFuture } from './components/MobileFuture.tsx'
import type { RunStatus } from './components/RunStatusGadget.tsx'
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
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** How long the "Outlook updated" confirmation stays before the gadget hides. */
const READY_LINGER_MS = 2500

export default function App() {
  const [selectedId, setSelectedId] = useState<SelectedId>(SEGMENTS[10].id) // "Mid-career mortgage-heavy accumulator"
  // `draft` is what the form shows; `client` is what has been submitted and simulated.
  const [draft, setDraft] = useState<ClientInputs>(() => stripMeta(SEGMENTS[10]))
  const [client, setClient] = useState<ClientInputs>(() => stripMeta(SEGMENTS[10]))
  const [toggles, setToggles] = useState<ScenarioToggles>(NO_TOGGLES)
  const [runs, setRuns] = useState(DEFAULT_RUNS)
  const [seed, setSeed] = useState(DEFAULT_SEED)
  const [llm, setLlm] = useState<LlmConfig>({ llm_mode: 'templated', model: null })
  const [llmCopy, setLlmCopy] = useState<{ key: string; headline: string; narrative: string } | null>(null)
  const [status, setStatus] = useState<RunStatus>('idle')
  const lingerTimer = useRef<number | null>(null)

  useEffect(() => {
    getLlmConfig().then(setLlm)
  }, [])

  const segment = useMemo(() => SEGMENTS.find((s) => s.id === selectedId) ?? null, [selectedId])
  const edited = useMemo(() => (segment ? !same(stripMeta(segment), client) : false), [segment, client])
  const dirty = useMemo(() => !same(draft, client), [draft, client])
  const running = status === 'simulating' || status === 'summarizing'

  /**
   * Every change to the submitted inputs re-runs the real Monte Carlo (baseline + toggled + scenario
   * readings + levers). `commit` shows the "simulating" state first and applies on the next tick so
   * the gadget is painted before the (synchronous, ~100 ms) pipeline runs.
   */
  const commit = useCallback((apply: () => void) => {
    if (lingerTimer.current) window.clearTimeout(lingerTimer.current)
    setStatus('simulating')
    window.setTimeout(apply, 30)
  }, [])

  const result = useMemo(
    () => runPipeline(client, toggles, { id: selectedId, label: segment?.label ?? 'Custom client' }, runs, seed),
    [client, toggles, selectedId, segment, runs, seed],
  )

  // After each simulation: either we're done (templated) or we ask the LLM to rewrite the draft.
  // Keyed on the facts so a stale response can never be applied to a newer simulation.
  const factsKey = JSON.stringify(result.summary.facts)
  useEffect(() => {
    if (lingerTimer.current) window.clearTimeout(lingerTimer.current)
    const finish = () => {
      setStatus('ready')
      lingerTimer.current = window.setTimeout(() => setStatus('idle'), READY_LINGER_MS)
    }
    if (llm.llm_mode === 'templated') {
      finish()
      return
    }
    setStatus('summarizing')
    const ctrl = new AbortController()
    fetchLlmSummary(result.summary, ctrl.signal).then((copy) => {
      if (ctrl.signal.aborted) return
      if (copy) setLlmCopy({ key: factsKey, ...copy })
      finish()
    })
    return () => ctrl.abort()
  }, [llm.llm_mode, factsKey, result.summary])

  const summary: SummaryOutput =
    llm.llm_mode !== 'templated' && llmCopy?.key === factsKey
      ? { ...result.summary, headline: llmCopy.headline, narrative: llmCopy.narrative, source: llm.llm_mode }
      : result.summary

  const submit = () => {
    if (!dirty || running) return
    commit(() => setClient(draft))
  }
  const selectSegment = (id: SelectedId) => {
    setSelectedId(id)
    if (id === 'custom') return // keep the current numbers as the starting point for editing
    const s = SEGMENTS.find((x) => x.id === id)!
    const fields = stripMeta(s)
    setDraft(fields)
    commit(() => setClient(fields))
  }
  const changeToggles = (t: ScenarioToggles) => commit(() => setToggles(t))
  const changeRuns = (n: number) => commit(() => setRuns(n))
  const changeSeed = (n: number) => commit(() => setSeed(n))

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Tangerine Wealth · UC1 demo</div>
          <h1>AI “Future Outlook” summary</h1>
          <p className="muted">
            Edit the client, hit <strong>Run outlook</strong>: a real Monte Carlo runs client-side, then the summary is written from its numbers.
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
          client={draft}
          onChange={setDraft}
          dirty={dirty}
          running={running}
          onSubmit={submit}
          onDiscard={() => setDraft(structuredClone(client))}
          edited={edited}
          onReset={() => {
            if (!segment) return
            const fields = stripMeta(segment)
            setDraft(fields)
            commit(() => setClient(fields))
          }}
          runs={runs}
          onRuns={changeRuns}
          seed={seed}
          onSeed={changeSeed}
        />
        <MobileFuture
          result={result}
          summary={summary}
          toggles={toggles}
          onToggles={changeToggles}
          status={status}
          llmMode={llm.llm_mode}
          llmModel={llm.model}
        />
      </main>
    </div>
  )
}
