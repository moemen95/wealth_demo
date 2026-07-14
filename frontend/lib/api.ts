import type {
  AgenticContextResult,
  AgenticDiscovery,
  AgenticMemory,
  Architecture,
  ChatResponse,
  InsightsResponse,
  PersonaDetail,
  PersonaId,
  PersonaSummary,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:8000";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  base: API_BASE,

  getPersonas: () =>
    fetch(`${API_BASE}/personas`).then((r) => json<PersonaSummary[]>(r)),

  getPersona: (id: PersonaId) =>
    fetch(`${API_BASE}/personas/${id}`).then((r) => json<PersonaDetail>(r)),

  getInsights: (persona: PersonaId, arch: Architecture, sessionId?: string) =>
    fetch(
      `${API_BASE}/insights/${persona}?arch=${arch}` +
        (sessionId ? `&session_id=${encodeURIComponent(sessionId)}` : ""),
    ).then((r) => json<InsightsResponse>(r)),

  agenticDiscovery: (persona: PersonaId, sessionId: string) =>
    fetch(`${API_BASE}/agentic/discovery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona_id: persona, session_id: sessionId }),
    }).then((r) => json<AgenticDiscovery>(r)),

  agenticContext: (body: {
    persona_id: PersonaId;
    session_id: string;
    answer: string;
    declined: boolean;
  }) =>
    fetch(`${API_BASE}/agentic/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => json<AgenticContextResult>(r)),

  clearAgenticMemory: (persona: PersonaId, sessionId: string) =>
    fetch(`${API_BASE}/agentic/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona_id: persona, session_id: sessionId }),
    }).then((r) => json<{ ok: boolean }>(r)),

  agenticMemory: (persona: PersonaId, sessionId: string) =>
    fetch(`${API_BASE}/agentic/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona_id: persona, session_id: sessionId }),
    }).then((r) => json<AgenticMemory>(r)),

  chat: (body: {
    persona_id: PersonaId;
    architecture: Architecture;
    session_id: string | null;
    message: string;
  }) =>
    fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => json<ChatResponse>(r)),
};
