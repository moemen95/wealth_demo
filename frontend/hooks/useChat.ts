"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { newSessionId } from "@/lib/store";
import type { Architecture, ChatMessage, PersonaId } from "@/lib/types";

/**
 * Owns one conversation for a (persona, architecture) pair. A stable session_id
 * is minted per pair so the Agentic architecture can demonstrate memory across
 * turns; changing persona/arch starts a fresh conversation.
 *
 * Pass `externalSessionId` to bind the conversation to a caller-owned session
 * (the shared Agentic memory) so the chat reads/writes the same memory as
 * discovery + insights; when it changes (e.g. Clear memory), the chat resets.
 */
export function useChat(
  persona: PersonaId | null,
  architecture: Architecture,
  externalSessionId?: string,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionId = useRef<string>(externalSessionId ?? newSessionId(architecture));

  // Reset conversation when persona, architecture, or the shared session change.
  useEffect(() => {
    setMessages([]);
    sessionId.current = externalSessionId ?? newSessionId(architecture);
  }, [persona, architecture, externalSessionId]);

  const reset = useCallback(() => {
    setMessages([]);
    sessionId.current = externalSessionId ?? newSessionId(architecture);
  }, [architecture, externalSessionId]);

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
