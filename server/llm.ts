/**
 * LLM providers + the `/api` request handler, shared by:
 *   - `server/index.ts`  — the standalone backend (`make backend` / `npm run backend`)
 *   - `vite.config.ts`   — mounted in-process by the dev server when no BACKEND_URL is set,
 *                          so `npm run dev` alone still works with a single command.
 *
 * Credentials are only ever read here, on the server; the browser calls `/api/*` and nothing else.
 *
 *   LLM_MODE=templated   (default) the offline generator in src/engine/summary.ts; /api/summary → 503
 *   LLM_MODE=openai      OpenAI Chat Completions — OPENAI_API_KEY (+ OPENAI_MODEL)
 *   LLM_MODE=gemini      Gemini on Google Cloud (Vertex AI) — no key; Application Default Credentials
 *                        (impersonated-SA ADC handled natively) + optional
 *                        GOOGLE_IMPERSONATE_SERVICE_ACCOUNT, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, GEMINI_MODEL
 *   (LLM_PROVIDER is accepted as an alias of LLM_MODE.)
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { GoogleAuth, Impersonated } from 'google-auth-library'

export type Env = Record<string, string | undefined>
export type Mode = 'templated' | 'openai' | 'gemini'

export interface SummaryRequest {
  facts: Record<string, unknown>
  /** The templated, already-grounded copy; the LLM's job is to rewrite it, not to re-derive it. */
  draft?: { headline: string; narrative: string }
  guardrails: string[]
  shape: Record<string, string>
}

const CLOUD_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

/** Plain-English meaning of the fact keys so the model never echoes internal names. */
const GLOSSARY: Record<string, string> = {
  money_lasts_pct: 'chance (%) the money lasts to the end age — the headline number',
  band: 'qualitative band: Good / Borderline / At Risk',
  end_age: 'planning horizon (life expectancy)',
  retirement_age: 'retirement age',
  runs: 'number of simulated paths',
  nw_at_retirement: 'median net worth at retirement, $ in today’s dollars',
  p25_at_retirement: 'lower end of the typical range at retirement, $',
  p75_at_retirement: 'upper end of the typical range at retirement, $',
  nw_at_end: 'median net worth left at the end age, $',
  nw_at_65: 'median net worth at 65, $',
  annual_spend: 'yearly spending in retirement, $',
  annual_contribution: 'yearly contributions before retirement, $',
  goal_pct: 'the target chance (%)',
  points_below_goal: 'how many percentage points short of the target',
  points_above_goal: 'how many percentage points above the target',
  scenarios_run_out_pct: '% of scenarios where the money runs out before the end age',
  median_runs_out_age: 'age at which the money runs out on the middle path',
  baseline_money_lasts_pct: 'chance (%) before any scenario toggle was applied',
  lever_money_lasts_pct: 'chance (%) if the single biggest lever is pulled',
  lever_delta_pts: 'improvement (points) from the biggest lever',
  save_more_monthly: '$ per month of extra saving in the "save more" lever',
  lever_years: 'years of extra work in the "retire later" lever',
  cut_spend_pct: '% spending reduction in the "spend less" lever',
  real_return_pct: 'assumed real return (%), after inflation',
  volatility_pct: 'assumed return volatility (%)',
  withdrawal_rate_pct: 'starting withdrawal rate (%)',
  segment_label: 'the client segment',
}

function systemPrompt(req: SummaryRequest): string {
  return [
    'You are the AI summary on a Canadian bank’s retirement-planning screen. You rewrite a correct DRAFT into warm, plain, confident language for the client.',
    'HARD RULES:',
    '- Every number you write MUST be one of the FACTS, written exactly (money as $974,468, percentages as 76%). Never invent, round, or compute a new figure.',
    '- Keep every fact the draft uses; you may drop minor ones, never add new ones.',
    '- Never mention internal names (no "lever years", "runs", "p25"); use the GLOSSARY meanings in everyday words.',
    '- Speak to the client as "you"; second sentence onward may vary in structure; no bullet points; no headings.',
    '- Match the draft’s tone for its band (Good: reassuring; Borderline: encouraging but honest; At Risk: direct, constructive).',
    '- End the narrative with the biggest lever as a concrete, achievable next step.',
    '- ' + req.guardrails.join(' ') + ' Do not give personalized advice; do not mention taxes as modelled.',
    'Return ONLY a JSON object with exactly this shape: ' + JSON.stringify(req.shape),
  ].join('\n')
}
function userPrompt(req: SummaryRequest): string {
  const glossary = Object.keys(req.facts)
    .filter((k) => GLOSSARY[k])
    .map((k) => `- ${k}: ${GLOSSARY[k]}`)
    .join('\n')
  return [
    'FACTS (the only numbers you may use):',
    JSON.stringify(req.facts, null, 2),
    '',
    'GLOSSARY:',
    glossary,
    '',
    req.draft ? `DRAFT headline: ${req.draft.headline}\nDRAFT narrative: ${req.draft.narrative}` : '',
    '',
    'Rewrite the DRAFT. Keep the same numbers. Return the JSON only.',
  ].join('\n')
}

/** Provider: OpenAI. */
async function callOpenAI(env: Env, req: SummaryRequest): Promise<unknown> {
  const model = env.OPENAI_MODEL || 'gpt-4o-mini'
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      // GPT-5 / o-series are reasoning models: they reject a custom temperature, and without
      // `reasoning_effort: minimal` a rewrite like this takes ~45 s instead of a few seconds.
      ...(/^(gpt-5|o\d)/i.test(model) ? { reasoning_effort: 'minimal' } : { temperature: 0.4 }),
      // No cap unless configured — reasoning tokens count against it and would truncate the JSON.
      ...(Number(env.OPENAI_MAX_COMPLETION_TOKENS) ? { max_completion_tokens: Number(env.OPENAI_MAX_COMPLETION_TOKENS) } : {}),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt(req) },
        { role: 'user', content: userPrompt(req) },
      ],
    }),
  })
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`)
  const data = (await r.json()) as { choices: { message: { content: string } }[] }
  return JSON.parse(data.choices[0].message.content)
}

/**
 * Vertex AI generateContent endpoint. Regional locations use a region-prefixed host
 * (`us-central1-aiplatform.googleapis.com`); the `global` location uses the bare host.
 */
export function vertexGenerateContentUrl(location: string, project: string, model: string): string {
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`
  return `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`
}

/**
 * Thinking control for Gemini. Reasoning ("thinking") tokens count against the output limit, so
 * with thinking left at its default a short JSON answer can come back truncated (finishReason
 * MAX_TOKENS, "Unterminated string in JSON") even when we send no cap of our own. This rewrite task
 * needs no reasoning, so we minimise it:
 *   - Gemini 2.5.x  → thinkingBudget: 0 (flash / flash-lite) or 128 (pro's minimum)
 *   - Gemini 3+     → thinkingLevel: "low" (the 3.x API replaced budgets with levels)
 *   - other models  → nothing sent
 * Overrides: GEMINI_THINKING_LEVEL (e.g. minimal|low|medium|high) or GEMINI_THINKING_BUDGET (number).
 */
export type ThinkingConfig = { thinkingBudget: number } | { thinkingLevel: string } | null
export function geminiThinkingConfig(model: string, env: { GEMINI_THINKING_LEVEL?: string; GEMINI_THINKING_BUDGET?: string } = {}): ThinkingConfig {
  if (env.GEMINI_THINKING_LEVEL) return { thinkingLevel: env.GEMINI_THINKING_LEVEL }
  if (env.GEMINI_THINKING_BUDGET !== undefined && env.GEMINI_THINKING_BUDGET !== '') return { thinkingBudget: Number(env.GEMINI_THINKING_BUDGET) }
  const version = /gemini-(\d+)(?:\.(\d+))?/i.exec(model)
  if (!version) return null
  const major = Number(version[1])
  const minor = Number(version[2] ?? 0)
  if (major >= 3) return { thinkingLevel: 'low' }
  if (major === 2 && minor >= 5) return { thinkingBudget: /pro/i.test(model) ? 128 : 0 }
  return null
}

/** Kept for callers/tests of the 2.5-era helper. */
export function geminiThinkingBudget(model: string, override?: string): number | null {
  const cfg = geminiThinkingConfig(model, { GEMINI_THINKING_BUDGET: override })
  return cfg && 'thinkingBudget' in cfg ? cfg.thinkingBudget : null
}

export interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number }
}

// Plain field, not a `public readonly` parameter property: server/*.ts runs under Node's strip-only
// TypeScript mode, which only accepts erasable syntax.
export class GeminiParseError extends Error {
  readonly finishReason: string
  constructor(message: string, finishReason: string) {
    super(message)
    this.finishReason = finishReason
  }
}

/** Pull the JSON object out of a generateContent reply, with a diagnostic error instead of a bare SyntaxError. */
export function parseGeminiJson(data: GeminiResponse): unknown {
  if (data.promptFeedback?.blockReason) throw new Error(`Vertex AI blocked the prompt: ${data.promptFeedback.blockReason}`)
  const cand = data.candidates?.[0]
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  try {
    return JSON.parse(text)
  } catch (e) {
    const reason = cand?.finishReason ?? 'unknown'
    const u = data.usageMetadata
    const usage = u ? ` usage: thoughts=${u.thoughtsTokenCount ?? 0} output=${u.candidatesTokenCount ?? 0} prompt=${u.promptTokenCount ?? 0}` : ''
    const hint =
      reason === 'MAX_TOKENS'
        ? ' (output truncated: thinking tokens exhausted the output limit — set GEMINI_THINKING_LEVEL=low / GEMINI_THINKING_BUDGET=0, or raise GEMINI_MAX_OUTPUT_TOKENS)'
        : ''
    throw new GeminiParseError(
      `Vertex AI returned non-JSON (finishReason ${reason}${hint}):${usage} ${String(e)} — text: ${JSON.stringify(text.slice(0, 160))}`,
      reason,
    )
  }
}

/** Provider: Gemini on Vertex AI, authenticated via ADC (optionally impersonating a service account). */
function makeGemini(env: Env) {
  const location = env.GOOGLE_CLOUD_LOCATION || 'us-central1'
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash'
  const impersonate = env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT
  // No output cap unless explicitly configured. If a reply still ends in MAX_TOKENS (thinking ate the
  // model's default limit) the call is retried once with a large explicit limit and thinking minimised.
  const maxOutputTokens = Number(env.GEMINI_MAX_OUTPUT_TOKENS) || undefined
  const thinking = geminiThinkingConfig(model, env)
  const RETRY_MAX_OUTPUT_TOKENS = 65536
  const auth = new GoogleAuth({ scopes: [CLOUD_SCOPE], projectId: env.GOOGLE_CLOUD_PROJECT || undefined })

  let clientPromise: Promise<{ token: () => Promise<string>; project: string }> | null = null
  const client = () =>
    (clientPromise ??= (async () => {
      const project = env.GOOGLE_CLOUD_PROJECT || (await auth.getProjectId())
      if (!project) throw new Error('No GCP project: set GOOGLE_CLOUD_PROJECT or configure ADC with a project')
      if (impersonate) {
        // Explicit impersonation layered on whatever ADC is present (user creds, SA key, metadata server).
        const source = await auth.getClient()
        const imp = new Impersonated({ sourceClient: source, targetPrincipal: impersonate, targetScopes: [CLOUD_SCOPE], lifetime: 3600 })
        return { project, token: async () => (await imp.getAccessToken()).token ?? '' }
      }
      // Plain ADC — this transparently covers an `impersonated_service_account` ADC file too.
      const c = await auth.getClient()
      return { project, token: async () => (await c.getAccessToken()).token ?? '' }
    })())

  return {
    model,
    describe: async () => {
      const c = await client()
      return `${model} @ ${c.project}/${location}${impersonate ? ` as ${impersonate}` : ' (ADC)'}`
    },
    call: async (req: SummaryRequest): Promise<unknown> => {
      const c = await client()
      const url = vertexGenerateContentUrl(location, c.project, model)
      const token = await c.token()

      const generate = async (cfg: { maxOutputTokens?: number; thinking: ThinkingConfig }): Promise<GeminiResponse> => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt(req) }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt(req) }] }],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: 'application/json',
              ...(cfg.maxOutputTokens ? { maxOutputTokens: cfg.maxOutputTokens } : {}),
              ...(cfg.thinking ? { thinkingConfig: cfg.thinking } : {}),
            },
          }),
        })
        if (!r.ok) {
          const body = await r.text()
          // A model that doesn't accept this thinking parameter (older API / different family) → go without.
          if (r.status === 400 && cfg.thinking && /thinking/i.test(body)) return generate({ ...cfg, thinking: null })
          throw new Error(`Vertex AI ${r.status}: ${body}`)
        }
        return (await r.json()) as GeminiResponse
      }

      const first = await generate({ maxOutputTokens, thinking })
      try {
        return parseGeminiJson(first)
      } catch (e) {
        if (!(e instanceof GeminiParseError) || e.finishReason !== 'MAX_TOKENS') throw e
        // Thinking exhausted the default output limit: retry with a large explicit limit and the
        // lowest thinking setting we know for this family, then give up with the diagnostic error.
        const minimal: ThinkingConfig = thinking && 'thinkingBudget' in thinking ? { thinkingBudget: thinking.thinkingBudget } : { thinkingLevel: 'low' }
        const second = await generate({ maxOutputTokens: Math.max(maxOutputTokens ?? 0, RETRY_MAX_OUTPUT_TOKENS), thinking: minimal })
        return parseGeminiJson(second)
      }
    },
  }
}

export interface ApiHandler {
  mode: Mode
  model: string | null
  /** One-line description for startup logs (resolves Gemini auth/project lazily). */
  describe: () => Promise<string>
  /** Handles `/api/config` and `/api/summary`. Returns false if the URL is not an API route. */
  handle: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>
}

export function createApiHandler(env: Env, log: { info: (m: string) => void; error: (m: string) => void } = console): ApiHandler {
  const requested = (env.LLM_MODE ?? env.LLM_PROVIDER ?? 'templated').toLowerCase() as Mode
  const openaiOk = requested === 'openai' && (env.OPENAI_API_KEY ?? '').length > 0
  const gemini = requested === 'gemini' ? makeGemini(env) : null
  const mode: Mode = openaiOk ? 'openai' : gemini ? 'gemini' : 'templated'
  const model = mode === 'openai' ? env.OPENAI_MODEL || 'gpt-4o-mini' : gemini?.model ?? null

  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
  }
  const readBody = (req: IncomingMessage) =>
    new Promise<string>((resolve, reject) => {
      let data = ''
      req.on('data', (c: Buffer) => (data += c.toString()))
      req.on('end', () => resolve(data))
      req.on('error', reject)
    })

  // Circuit breaker: a quota/auth failure won't heal by retrying on every slider change, so after one
  // such error the provider is skipped (503, no upstream call) for a cool-down; the client keeps the
  // templated copy meanwhile.
  const COOL_DOWN_MS = 10 * 60 * 1000
  let disabledUntil = 0
  let disabledReason = ''
  const isHardFailure = (msg: string) =>
    /insufficient_quota|credit_balance_exhausted|invalid_api_key|invalid_grant|reauth|Could not load the default credentials|PERMISSION_DENIED|UNAUTHENTICATED/i.test(msg)

  return {
    mode,
    model,
    describe: async () => (gemini ? `gemini ${await gemini.describe()}` : `${mode}${model ? ` (${model})` : ''}`),
    async handle(req, res) {
      const path = (req.url ?? '').split('?')[0]
      if (path === '/api/config') {
        json(res, 200, { llm_mode: mode, model })
        return true
      }
      if (path === '/api/summary') {
        if (req.method !== 'POST') json(res, 405, { error: 'POST only' })
        else if (mode === 'templated') json(res, 503, { error: 'LLM mode disabled (set LLM_MODE=openai or LLM_MODE=gemini)' })
        else if (Date.now() < disabledUntil) json(res, 503, { error: `LLM temporarily disabled after: ${disabledReason}` })
        else {
          try {
            const body = JSON.parse(await readBody(req)) as SummaryRequest
            const out = mode === 'gemini' ? await gemini!.call(body) : await callOpenAI(env, body)
            json(res, 200, { ...(out as object), provider: mode, model })
          } catch (e) {
            let msg = String(e)
            if (/invalid_grant|reauth|Could not load the default credentials/i.test(msg))
              msg += ' — ADC is missing or expired; run `gcloud auth application-default login` (add --impersonate-service-account=… as needed)'
            if (isHardFailure(msg)) {
              disabledUntil = Date.now() + COOL_DOWN_MS
              disabledReason = msg.split('\n')[0].slice(0, 200)
              msg += ` — skipping the provider for ${COOL_DOWN_MS / 60000} min; the templated summary stays in use`
            }
            log.error(`LLM error: ${msg}`)
            json(res, 502, { error: msg })
          }
        }
        return true
      }
      return false
    },
  }
}
