"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { newSessionId } from "@/lib/store";
import type { PersonaId } from "@/lib/types";

/**
 * Owns one stable Agentic session id per persona. Discovery, insights, and the
 * drill-in chat all share this id so they read/write the SAME memory. `clear()`
 * wipes that memory server-side and mints a fresh id, which forces dependents
 * (whose effects depend on `sessionId`) to restart from discovery.
 */
export function useAgenticSession(persona: PersonaId | null) {
  const [sessionId, setSessionId] = useState(() => newSessionId("agentic"));
  const lastPersona = useRef(persona);

  // A fresh conversation per persona — but keep the initial id on mount (only
  // re-mint when the persona actually changes) to avoid a redundant discovery run.
  useEffect(() => {
    if (lastPersona.current !== persona) {
      lastPersona.current = persona;
      setSessionId(newSessionId("agentic"));
    }
  }, [persona]);

  const clear = useCallback(async () => {
    if (persona) {
      try {
        await api.clearAgenticMemory(persona, sessionId);
      } catch {
        /* ignore — still restart locally */
      }
    }
    setSessionId(newSessionId("agentic"));
  }, [persona, sessionId]);

  return { sessionId, clear };
}
