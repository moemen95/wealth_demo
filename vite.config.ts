import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createApiHandler } from './server/llm.ts'

/**
 * `/api` in development:
 *   - BACKEND_URL set   → proxy `/api` to the standalone backend (`make dev` runs both processes).
 *   - BACKEND_URL unset → mount the very same handler in-process, so plain `npm run dev` still works
 *                         as a single command. Credentials stay on the server either way.
 */
function apiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'tangerine-api',
    configureServer(server) {
      const api = createApiHandler(env, {
        info: (m) => server.config.logger.info(`  ➜  ${m}`),
        error: (m) => server.config.logger.error(`  ➜  ${m}`),
      })
      api.describe()
        .then((d) => server.config.logger.info(`  ➜  LLM: ${d} (in-process /api)`))
        .catch((e) => server.config.logger.warn(`  ➜  LLM: ${api.mode} — auth check failed: ${e}`))
      server.middlewares.use((req, res, next) => {
        api.handle(req, res).then((handled) => (handled ? undefined : next())).catch(next)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // '' prefix → read ALL vars from .env (server-side only; only VITE_* ever reach import.meta.env).
  // Shell variables (e.g. exported by the Makefile) take precedence over .env.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...(process.env as Record<string, string>) }
  const backend = env.BACKEND_URL?.replace(/\/$/, '')
  const port = Number(env.FRONTEND_PORT) || 5173
  const proxy = backend ? { '/api': { target: backend, changeOrigin: true } } : undefined

  return {
    plugins: [react(), ...(backend ? [] : [apiPlugin(env)])],
    server: { port, open: false, proxy },
    preview: { port: Number(env.PREVIEW_PORT) || 4173, proxy },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  }
})
