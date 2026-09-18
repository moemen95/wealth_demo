/**
 * Standalone backend: the `/api` routes as their own process, so the LLM proxy also exists outside
 * the Vite dev server (preview, production, or a separately deployed API).
 *
 *   BACKEND_PORT   port to listen on (default 8787)
 *   CORS_ORIGINS   comma-separated allowed origins (default: http://localhost:5173)
 *   + the LLM_* / OPENAI_* / GOOGLE_* variables documented in server/llm.ts
 *
 * Run with `make backend` (sources .env) or `npm run backend`. Needs Node ≥ 22.18 (runs .ts directly).
 */
import { createServer } from 'node:http'
import { createApiHandler } from './llm.ts'

const env = process.env
const port = Number(env.BACKEND_PORT) || 8787
const origins = (env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean)
const api = createApiHandler(env)

const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin && (origins.includes('*') || origins.includes(origin))) {
    res.setHeader('access-control-allow-origin', origin)
    res.setHeader('vary', 'Origin')
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
    res.setHeader('access-control-allow-headers', 'content-type')
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }
  if ((req.url ?? '').split('?')[0] === '/healthz') {
    res.setHeader('content-type', 'application/json')
    return res.end(JSON.stringify({ ok: true, llm_mode: api.mode }))
  }
  if (!(await api.handle(req, res))) {
    res.statusCode = 404
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'not found' }))
  }
})

server.listen(port, async () => {
  console.log(`backend listening on http://localhost:${port}  (CORS: ${origins.join(', ')})`)
  try {
    console.log(`LLM: ${await api.describe()}`)
  } catch (e) {
    console.warn(`LLM: ${api.mode} — auth check failed: ${e}`)
  }
})
