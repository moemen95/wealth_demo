"use client";

import { useEffect, useState } from "react";
import { Cpu, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useDemoStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Shows the active LLM provider and lets the presenter flip it live on stage
 * (SPEC §14 Beat 4). Clicking toggles OpenAI <-> Gemini via POST /provider.
 */
export function ProviderBadge() {
  const provider = useDemoStore((s) => s.provider);
  const setProvider = useDemoStore((s) => s.setProvider);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getProvider().then(setProvider).catch(() => {});
  }, [setProvider]);

  const toggle = async () => {
    if (!provider || busy) return;
    setBusy(true);
    const next = provider.provider === "openai" ? "gemini" : "openai";
    try {
      setProvider(await api.setProvider(next));
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const isOpenAI = provider?.provider === "openai";

  return (
    <button
      onClick={toggle}
      title="Click to swap the LLM provider live"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
        isOpenAI
          ? "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100"
          : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cpu className="h-3.5 w-3.5" />}
      {provider ? provider.label : "…"}
    </button>
  );
}
