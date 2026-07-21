"use client";

import { ARCHITECTURES, type Architecture } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ArchitectureToggle({
  value,
  onChange,
}: {
  value: Architecture;
  onChange: (a: Architecture) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border bg-muted p-1">
      {ARCHITECTURES.map((a) => (
        <button
          key={a.id}
          onClick={() => onChange(a.id)}
          title={a.blurb}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            value === a.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
