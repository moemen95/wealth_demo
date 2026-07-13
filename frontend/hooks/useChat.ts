"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { newSessionId } from "@/lib/store";
import type { Architecture, ChatMessage, PersonaId } from "@/lib/types";

/**
 * Owns one conversation for a (persona, architecture) pair. A stable session_id
 * is minted per pair so the Agentic architecture can demonstrate memory across
 * turns; changing persona/arch starts a fresh conversation.
 */
export function useChat(persona: PersonaId | null, architecture: Architecture) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionId = useRef<string>(newSessionId(architecture));

  // Reset conversation when persona or architecture changes.
  useEffect(() => {
    setMessages([]);
    sessionId.current = newSessionId(architecture);
  }, [persona, architecture]);

  const reset = useCallback(() => {
    setMessages([]);
    sessionId.current = newSessionId(architecture);
  }, [architecture]);

  const send = useCallback(
    async (text: string, context?: string) => {
      if (!persona || !text.trim() || loading) return;
      // Show the user's own words; send an optionally context-tagged message so
      // the model stays anchored to the insight being discussed. Raw (stateless)
      // only ever sees this tag — never earlier turns — which is the intended
      // "loses context in a longer conversation" contrast.
      const outgoing = context ? `${context}\n\n${text}` : text;
      setMessages((m) => [...m, { role: "user", content: text }]);
      setLoading(true);
      try {
        const res = await api.chat({
          persona_id: persona,
          architecture,
          session_id: sessionId.current,
          message: outgoing,
        });
        sessionId.current = res.session_id;
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: res.reply,
            toolCalls: res.tool_calls,
            provider: res.provider,
            architecture: res.architecture,
            timingMs: res.timing_ms,
            error: res.error,
          },
        ]);
      } catch (e) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `Request failed: ${(e as Error).message}`,
            architecture,
            error: (e as Error).message,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [persona, architecture, loading],
  );

  return { messages, loading, send, reset };
}
