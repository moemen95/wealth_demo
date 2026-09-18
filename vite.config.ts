import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { GoogleAuth, Impersonated } from 'google-auth-library'

/**
 * Optional real-LLM mode — a tiny proxy route on the dev server.
 *
 * The demo is fully offline by default (templated summary generator in `src/engine/summary.ts`).
 * `LLM_MODE` picks a provider; credentials are read HERE, on the dev server, and never shipped to
 * the browser — the client only ever calls the local `/api/summary` route.
 *
 *   LLM_MODE=templated   (default) offline generator
 *   LLM_MODE=openai      OpenAI Chat Completions — needs OPENAI_API_KEY (+ OPENAI_MODEL)
 *   LLM_MODE=gemini      Gemini on Google Cloud (Vertex AI) — no key. Auth comes from Application
 *                        Default Credentials already in the environment: an impersonated-SA ADC
 *                        (`gcloud auth application-default login --impersonate-service-account=…`),
 *                        GOOGLE_APPLICATION_CREDENTIALS, or the metadata server. Set
 *                        GOOGLE_IMPERSONATE_SERVICE_ACCOUNT to impersonate explicitly on top of ADC.
 *                        Project/location: GOOGLE_CLOUD_PROJECT (falls back to the ADC project),
 *                        GOOGLE_CLOUD_LOCATION (default us-central1), GEMINI_MODEL.
 */

type Mode = 'templated' | 'openai' | 'gemini'
interface SummaryRequest {
  facts: Record<string, unknown>
  guardrails: string[]
  shape: Record<string, string>
}

const CLOUD_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

function systemPrompt(req: SummaryRequest): string {
  return [
    'You write a short, plain-language reading of a retirement Monte Carlo simulation for a Canadian bank client.',
    'RULES: every number you write MUST appear verbatim in the FACTS list — never invent or round figures.',
    'Use qualitative bands (Good/Borderline/At Risk) over false precision. This is general information, not advice.',
    'Respect these guardrails: ' + req.guardrails.join(' '),
    'Return ONLY a JSON object with exactly this shape: ' + JSON.stringify(req.shape),
  ].join('\n')
}
const userPrompt = (req: SummaryRequest) => 'FACTS:\n' + JSON.stringify(req.facts, null, 2)

/** Provider: OpenAI. */
async function callOpenAI(env: Record<string, string>, req: SummaryRequest): Promise<unknown> {
  const model = env.OPENAI_MODEL || 'gpt-4o-mini'
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0.4,
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

/** Provider: Gemini on Vertex AI, authenticated via ADC (optionally impersonating a service account). */
function makeGemini(env: Record<string, string>) {
  const location = env.GOOGLE_CLOUD_LOCATION || 'us-central1'
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash'
  const impersonate = env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT
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
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${c.project}/locations/${location}/publishers/google/models/${model}:generateContent`
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${await c.token()}` },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt(req) }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt(req) }] }],
          generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
        }),
      })
      if (!r.ok) throw new Error(`Vertex AI ${r.status}: ${await r.text()}`)
      const data = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      return JSON.parse(text)
    },
  }
}

function llmProxy(env: Record<string, string>): Plugin {
  const requested = (env.LLM_MODE ?? 'templated').toLowerCase() as Mode
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

  return {
    name: 'tangerine-llm-proxy',
    configureServer(server) {
      if (gemini) gemini.describe().then((d) => server.config.logger.info(`  ➜  LLM: gemini ${d}`)).catch((e) => server.config.logger.warn(`  ➜  LLM: gemini auth failed — ${e}`))
      else server.config.logger.info(`  ➜  LLM: ${mode}${model ? ` (${model})` : ''}`)

      server.middlewares.use('/api/config', (_req, res) => json(res, 200, { llm_mode: mode, model }))
      server.middlewares.use('/api/summary', async (req, res) => {
        if (req.method !== 'POST') return json(res, 405, { error: 'POST only' })
        if (mode === 'templated') return json(res, 503, { error: 'LLM mode disabled (set LLM_MODE=openai or LLM_MODE=gemini)' })
        try {
          const body = JSON.parse(await readBody(req)) as SummaryRequest
          const out = mode === 'gemini' ? await gemini!.call(body) : await callOpenAI(env, body)
          json(res, 200, { ...(out as object), provider: mode, model })
        } catch (e) {
          let msg = String(e)
          if (/invalid_grant|reauth|Could not load the default credentials/i.test(msg))
            msg += ' — ADC is missing or expired; run `gcloud auth application-default login` (add --impersonate-service-account=… as needed)'
          server.config.logger.error(`  ➜  LLM error: ${msg}`)
          json(res, 502, { error: msg })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // '' prefix → read ALL vars (server-side only; nothing here is exposed via import.meta.env).
  const env = { ...loadEnv(mode, process.cwd(), ''), ...(process.env as Record<string, string>) }
  return {
    plugins: [react(), llmProxy(env)],
    server: { port: 5173, open: false },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  }
})
