"use client";

import { ArrowLeft } from "lucide-react";
import { ChatInput } from "@/components/ChatInput";
import { ChatPanel } from "@/components/ChatPanel";
import { InsightCard } from "@/components/InsightCard";
import { Card } from "@/components/ui/card";
import { useChat } from "@/hooks/useChat";
import type { Architecture, Insight, PersonaId } from "@/lib/types";

/** Compact context tag prepended to chat turns so the model stays on-topic. */
export function insightContext(insight: Insight): string {
  const parts = [`Discussing the insight "${insight.title}": ${insight.body}`];
  if (insight.recommended_action)
    parts.push(`Its recommended action: ${insight.recommended_action}`);
  return `[${parts.join(" ")}]`;
}

/**
 * Focused conversation about a single insight: the insight pinned at top, an
 * empty chat below (seeded only with the insight as context on each turn), and a
 * Back control to return to the insights grid. Mount with a `key` tied to the
 * insight so switching insights starts a fresh conversation.
 */
export function InsightDetail({
  persona,
  architecture,
  insight,
  onBack,
}: {
  persona: PersonaId;
  architecture: Architecture;
  insight: Insight;
  onBack: () => void;
}) {
  const { messages, loading, send } = useChat(persona, architecture);
  const context = insightContext(insight);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to insights
      </button>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pinned insight */}
        <div>
          <InsightCard insight={insight} pinned />
        </div>

        {/* Scoped conversation */}
        <Card className="flex flex-col overflow-hidden">
          <ChatPanel
            architecture={architecture}
            messages={messages}
            loading={loading}
            emptyHint="Ask anything about this insight."
          />
          <div className="border-t bg-muted/30 p-3">
            <ChatInput
              onSend={(text) => send(text, context)}
              disabled={loading}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
