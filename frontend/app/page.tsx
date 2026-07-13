"use client";

import { useEffect, useState } from "react";
import { ArchitectureToggle } from "@/components/ArchitectureToggle";
import { FinancialSnapshot } from "@/components/FinancialSnapshot";
import { InsightDetail } from "@/components/InsightDetail";
import { InsightsCards } from "@/components/InsightsCard";
import { PersonaSelector } from "@/components/PersonaSelector";
import { TopBar } from "@/components/TopBar";
import { useDemoStore } from "@/lib/store";
import type { Insight } from "@/lib/types";

export default function HomePage() {
  const persona = useDemoStore((s) => s.persona);
  const architecture = useDemoStore((s) => s.architecture);
  const setPersona = useDemoStore((s) => s.setPersona);
  const setArchitecture = useDemoStore((s) => s.setArchitecture);

  const [selected, setSelected] = useState<Insight | null>(null);

  // Leaving an insight open across a persona/architecture switch would show a
  // stale card, so drop back to the grid whenever the context changes.
  useEffect(() => {
    setSelected(null);
  }, [persona, architecture]);

  return (
    <div className="min-h-screen">
      <TopBar>
        <ArchitectureToggle value={architecture} onChange={setArchitecture} />
      </TopBar>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-4 lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Persona
          </h2>
          <PersonaSelector value={persona} onChange={setPersona} />
          {persona && <FinancialSnapshot persona={persona} />}
        </aside>

        {/* Main — insights are the hero; click one to converse about it. */}
        <main className="space-y-6">
          {persona && !selected && (
            <InsightsCards
              persona={persona}
              architecture={architecture}
              onSelect={setSelected}
            />
          )}

          {persona && selected && (
            <InsightDetail
              key={`${architecture}-${selected.title}`}
              persona={persona}
              architecture={architecture}
              insight={selected}
              onBack={() => setSelected(null)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
