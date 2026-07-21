"use client";

import { useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgenticMemory as AgenticMemoryData } from "@/lib/types";

/**
 * Shows what the Agentic approach has stored in memory to tailor its insights:
 * the currently-active context and an append-only log of every answer saved this
 * session. Collapsed by default, right under the Insights header.
 */
export function AgenticMemory({ memory }: { memory: AgenticMemoryData | null }) {
  const [open, setOpen] = useState(false);
  if (!memory) return null;

  const entries = memory.entries ?? [];
  const active = memory.declined
    ? "You declined — insights use profile-based assumptions"
    : memory.client_context || "Nothing saved yet";

  return (
    <div className="rounded-md border bg-muted/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Brain className="h-4 w-4 text-primary" />
        <span className="font-semibold text-foreground">Agent memory</span>
        <span className="truncate text-muted-foreground">
          — tailoring using: {active}
        </span>
        {entries.length > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {entries.length} saved
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t px-3 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Currently tailoring using
            </div>
            <p
              className={cn(
                "mt-0.5 text-sm",
                memory.declined || !memory.client_context
                  ? "text-muted-foreground"
                  : "text-foreground",
              )}
            >
              {active}
            </p>
          </div>

          {entries.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Saved responses ({entries.length})
              </div>
              <ol className="mt-1 space-y-1">
                {entries.map((e, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">
                      {i + 1}.
                    </span>
                    <span
                      className={cn(
                        e.declined ? "italic text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {e.declined
                        ? "Declined to share goals"
                        : e.context || "(empty)"}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
