"use client";

import { useEffect, useState } from "react";
import { Sprout, Landmark, Gem } from "lucide-react";
import { api } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import type { PersonaId, PersonaSummary } from "@/lib/types";

const ICONS: Record<PersonaId, typeof Sprout> = {
  first: Sprout,
  middle: Landmark,
  affluent: Gem,
};

const ACCENT: Record<PersonaId, string> = {
  first: "data-[active=true]:border-persona-first data-[active=true]:ring-persona-first/30 text-persona-first",
  middle: "data-[active=true]:border-persona-middle data-[active=true]:ring-persona-middle/30 text-persona-middle",
  affluent: "data-[active=true]:border-persona-affluent data-[active=true]:ring-persona-affluent/30 text-persona-affluent",
};

export function PersonaSelector({
  value,
  onChange,
}: {
  value: PersonaId | null;
  onChange: (p: PersonaId) => void;
}) {
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);

  useEffect(() => {
    api.getPersonas().then(setPersonas).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {personas.map((p) => {
        const Icon = ICONS[p.persona_id];
        const active = value === p.persona_id;
        return (
          <button
            key={p.persona_id}
            data-active={active}
            onClick={() => onChange(p.persona_id)}
            className={cn(
              "group rounded-lg border-2 bg-card p-3 text-left transition-all hover:shadow-md",
              "data-[active=true]:ring-2",
              ACCENT[p.persona_id],
            )}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-muted p-2">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground">{p.name}</div>
                <div className="truncate text-xs text-muted-foreground">{p.tagline}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="capitalize">{p.persona_id} · age {p.age}</span>
              <span className="font-medium text-foreground">
                {formatCurrency(p.portfolio_total)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
