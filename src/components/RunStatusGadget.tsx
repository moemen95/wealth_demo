import type { SummaryOutput } from '../engine/types.ts'

/**
 * idle        → nothing shown
 * simulating  → the Monte Carlo is running (synchronous, painted first thanks to a tick delay)
 * summarizing → simulation done, waiting for the LLM rewrite
 * ready       → everything applied; lingers briefly, then back to idle
 */
export type RunStatus = 'idle' | 'simulating' | 'summarizing' | 'ready'

interface Props {
  status: RunStatus
  runs: number
  llmMode: 'templated' | 'openai' | 'gemini'
  llmModel: string | null
  /** The summary currently on screen — tells "ready" whether the LLM copy landed or we fell back. */
  summary: SummaryOutput
}

const providerName = (m: string) => (m === 'gemini' ? 'Gemini' : m === 'openai' ? 'OpenAI' : 'templated')

export function RunStatusGadget({ status, runs, llmMode, llmModel, summary }: Props) {
  if (status === 'idle') return null
  const usesLlm = llmMode !== 'templated'
  const simDone = status !== 'simulating'
  const aiDone = status === 'ready'
  const fellBack = aiDone && usesLlm && summary.source === 'templated'

  return (
    <div className={`run-status ${status}`} role="status" aria-live="polite">
      <div className={`step ${simDone ? 'done' : 'active'}`}>
        <span className="icon">{simDone ? '✓' : <i className="spinner" />}</span>
        <span>{simDone ? `Simulated ${runs.toLocaleString('en-US')} futures` : `Running ${runs.toLocaleString('en-US')} simulations…`}</span>
      </div>
      {usesLlm ? (
        <div className={`step ${aiDone ? (fellBack ? 'warn' : 'done') : status === 'summarizing' ? 'active' : 'pending'}`}>
          <span className="icon">{aiDone ? (fellBack ? '!' : '✓') : status === 'summarizing' ? <i className="spinner" /> : '·'}</span>
          <span>
            {aiDone
              ? fellBack
                ? `${providerName(llmMode)} unavailable — showing the templated summary`
                : `Summary written by ${providerName(llmMode)}${llmModel ? ` (${llmModel})` : ''}`
              : `Writing your summary with ${providerName(llmMode)}…`}
          </span>
        </div>
      ) : (
        <div className={`step ${aiDone ? 'done' : 'active'}`}>
          <span className="icon">{aiDone ? '✓' : <i className="spinner" />}</span>
          <span>{aiDone ? 'Summary generated from the simulation' : 'Generating summary…'}</span>
        </div>
      )}
      {aiDone && <div className="step done headline">Outlook updated</div>}
    </div>
  )
}
