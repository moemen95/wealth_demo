"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCall } from "@/lib/types";

export function ToolTrace({ calls }: { calls: ToolCall[] }) {
  const [open, setOpen] = useState(false);
  if (!calls?.length) return null;

  return (
    <div className="mt-2 rounded-md border bg-muted/50 text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Wrench className="h-3 w-3" />
        Tool trace · {calls.length} call{calls.length > 1 ? "s" : ""}
      </button>
      {open && (
        <ol className="space-y-2 px-3 pb-2">
          {calls.map((c, i) => (
            <li key={i} className="rounded border bg-card p-2">
              <div className="font-mono font-semibold text-foreground">
                {i + 1}. {c.name}({argSummary(c.arguments)})
              </div>
              {c.result != null && (
                <pre className={cn("mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground")}>
                  {JSON.stringify(c.result, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function argSummary(args: Record<string, unknown>) {
  return Object.entries(args || {})
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
}
