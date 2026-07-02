"use client";

import { ArchitectureToggle } from "@/components/ArchitectureToggle";
import { ChatInput } from "@/components/ChatInput";
import { ChatPanel } from "@/components/ChatPanel";
import { InsightsCards } from "@/components/InsightsCard";
import { PersonaSelector } from "@/components/PersonaSelector";
import { PortfolioChart } from "@/components/PortfolioChart";
import { TopBar } from "@/components/TopBar";
import { Card } from "@/components/ui/card";
import { useChat } from "@/hooks/useChat";
import { useDemoStore } from "@/lib/store";

export default function HomePage() {
  const persona = useDemoStore((s) => s.persona);
  const architecture = useDemoStore((s) => s.architecture);
  const setPersona = useDemoStore((s) => s.setPersona);
  const setArchitecture = useDemoStore((s) => s.setArchitecture);

  const { messages, loading, send } = useChat(persona, architecture);

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
          {persona === "affluent" && <PortfolioChart persona="affluent" />}
        </aside>

        {/* Main */}
        <main className="space-y-6">
          {persona && <InsightsCards persona={persona} architecture={architecture} />}

          <Card className="overflow-hidden">
            <ChatPanel
              architecture={architecture}
              messages={messages}
              loading={loading}
              emptyHint="Ask a follow-up, or try a suggested question below."
            />
            <div className="border-t bg-muted/30 p-3">
              <ChatInput onSend={send} disabled={loading || !persona} />
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
