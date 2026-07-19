"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ChatInput } from "@/components/ChatInput";
import { ChatPanel } from "@/components/ChatPanel";
import { FinancialSnapshot } from "@/components/FinancialSnapshot";
import { InsightCard } from "@/components/InsightCard";
import { InsightsCards } from "@/components/InsightsCard";
import { insightContext } from "@/components/InsightDetail";
import { TopBar } from "@/components/TopBar";
import { Card } from "@/components/ui/card";
import { useChat } from "@/hooks/useChat";
import { useDemoStore } from "@/lib/store";
import { ARCHITECTURES, type Architecture, type Insight, type PersonaId } from "@/lib/types";
import { cn } from "@/lib/utils";

const PERSONAS: { id: PersonaId; label: string }[] = [
  { id: "first", label: "First" },
  { id: "middle", label: "Middle" },
  { id: "affluent", label: "Mass Affluent" },
];

type ChatApi = ReturnType<typeof useChat>;

export default function ComparePage() {
  const persona = useDemoStore((s) => s.persona);
  const setPersona = useDemoStore((s) => s.setPersona);

  const raw = useChat(persona, "raw");
  const skills = useChat(persona, "skills");
  const agentic = useChat(persona, "agentic");

  // Per-column drill-in: which insight (if any) each column is focused on.
  const [selected, setSelected] = useState<Record<Architecture, Insight | null>>({
    raw: null,
    skills: null,
    agentic: null,
  });

  const columns: { arch: Architecture; chat: ChatApi }[] = [
    { arch: "raw", chat: raw },
    { arch: "skills", chat: skills },
    { arch: "agentic", chat: agentic },
  ];

  const anyLoading = raw.loading || skills.loading || agentic.loading;

  // Broadcast: one question to all three architectures at once.
  const sendAll = (text: string) => {
    raw.send(text);
    skills.send(text);
    agentic.send(text);
  };

  const pick = (arch: Architecture, insight: Insight) =>
    setSelected((s) => ({ ...s, [arch]: insight }));

  const back = (arch: Architecture, chat: ChatApi) => {
    setSelected((s) => ({ ...s, [arch]: null }));
    chat.reset();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar>
        <div className="inline-flex rounded-lg border bg-muted p-1">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPersona(p.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                persona === p.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </TopBar>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 p-4">
        <p className="text-sm text-muted-foreground">
          One persona, three architectures, side-by-side. Compare each approach&apos;s{" "}
          <b>insights</b> — <b>Raw</b> jumps to a risky call with no grounding,{" "}
          <b>Skills</b> adds grounded context, <b>Intelligent</b> builds full scenarios
          with alternatives and a projection. Click any insight to converse, or ask all
          three at once below.
        </p>

        {persona && (
          <div className="lg:max-w-sm">
            <FinancialSnapshot persona={persona} />
          </div>
        )}

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
          {columns.map(({ arch, chat }) => {
            const sel = selected[arch];
            // Flip to chat once a column has a pinned insight or any messages
            // (e.g. from a broadcast), so the transcript is visible.
            const chatMode = sel !== null || chat.messages.length > 0;
            return (
              <Card key={arch} className="flex flex-col overflow-hidden">
                <div className="border-b bg-muted/40 px-3 py-2">
                  <h2 className="font-semibold">
                    {ARCHITECTURES.find((a) => a.id === arch)?.label ?? arch}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {ARCHITECTURES.find((a) => a.id === arch)?.blurb}
                  </p>
                </div>

                {!persona ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    Select a persona.
                  </div>
                ) : !chatMode ? (
                  <div className="p-3">
                    <InsightsCards
                      persona={persona}
                      architecture={arch}
                      onSelect={(ins) => pick(arch, ins)}
                      compact
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-center gap-2 border-b p-2">
                      <button
                        onClick={() => back(arch, chat)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Insights
                      </button>
                    </div>
                    {sel && (
                      <div className="border-b p-2">
                        <InsightCard insight={sel} pinned />
                      </div>
                    )}
                    <ChatPanel
                      architecture={arch}
                      messages={chat.messages}
                      loading={chat.loading}
                      compact
                      emptyHint="Ask about this insight."
                    />
                    <div className="border-t bg-muted/30 p-2">
                      <ChatInput
                        onSend={(text) =>
                          chat.send(text, sel ? insightContext(sel) : undefined)
                        }
                        disabled={chat.loading}
                        showSuggestions={false}
                      />
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="sticky bottom-0 rounded-lg border bg-background/90 p-3 backdrop-blur">
          <ChatInput onSend={sendAll} disabled={anyLoading || !persona} />
        </div>
      </div>
    </div>
  );
}
