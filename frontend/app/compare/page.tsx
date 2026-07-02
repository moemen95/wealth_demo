"use client";

import { ChatInput } from "@/components/ChatInput";
import { ChatPanel } from "@/components/ChatPanel";
import { TopBar } from "@/components/TopBar";
import { Card } from "@/components/ui/card";
import { useChat } from "@/hooks/useChat";
import { useDemoStore } from "@/lib/store";
import { ARCHITECTURES, type PersonaId } from "@/lib/types";
import { cn } from "@/lib/utils";

const PERSONAS: { id: PersonaId; label: string }[] = [
  { id: "first", label: "First" },
  { id: "middle", label: "Middle" },
  { id: "affluent", label: "Mass Affluent" },
];

export default function ComparePage() {
  const persona = useDemoStore((s) => s.persona);
  const setPersona = useDemoStore((s) => s.setPersona);

  const raw = useChat(persona, "raw");
  const skills = useChat(persona, "skills");
  const agentic = useChat(persona, "agentic");
  const columns = [
    { arch: "raw" as const, chat: raw },
    { arch: "skills" as const, chat: skills },
    { arch: "agentic" as const, chat: agentic },
  ];

  const anyLoading = raw.loading || skills.loading || agentic.loading;

  const sendAll = (text: string) => {
    raw.send(text);
    skills.send(text);
    agentic.send(text);
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
          One question, three architectures, side-by-side. Watch{" "}
          <b>Raw</b> hallucinate, <b>Skills</b> return a bare number, and{" "}
          <b>Agentic</b> return a contextualised answer with a tool trace.
        </p>

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
          {columns.map(({ arch, chat }) => (
            <Card key={arch} className="flex flex-col overflow-hidden">
              <div className="border-b bg-muted/40 px-3 py-2">
                <h2 className="font-semibold capitalize">{arch}</h2>
                <p className="text-xs text-muted-foreground">
                  {ARCHITECTURES.find((a) => a.id === arch)?.blurb}
                </p>
              </div>
              <ChatPanel
                architecture={arch}
                messages={chat.messages}
                loading={chat.loading}
                compact
                emptyHint="Awaiting a question…"
              />
            </Card>
          ))}
        </div>

        <div className="sticky bottom-0 rounded-lg border bg-background/90 p-3 backdrop-blur">
          <ChatInput onSend={sendAll} disabled={anyLoading || !persona} />
        </div>
      </div>
    </div>
  );
}
