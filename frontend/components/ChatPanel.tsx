"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ArchitectureBadge } from "@/components/ArchitectureBadge";
import { ToolTrace } from "@/components/ToolTrace";
import { cn } from "@/lib/utils";
import type { Architecture, ChatMessage } from "@/lib/types";

export function ChatPanel({
  architecture,
  messages,
  loading,
  compact = false,
  emptyHint,
}: {
  architecture: Architecture;
  messages: ChatMessage[];
  loading: boolean;
  compact?: boolean;
  emptyHint?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex h-full flex-col">
      {compact && (
        <div className="flex items-center gap-2 border-b p-2">
          <ArchitectureBadge architecture={architecture} />
        </div>
      )}
      <div
        ref={scrollRef}
        className={cn(
          "scroll-thin flex-1 space-y-3 overflow-y-auto p-3",
          compact ? "min-h-[280px]" : "min-h-[320px]",
        )}
      >
        {messages.length === 0 && !loading && (
          <p className="pt-8 text-center text-sm text-muted-foreground">
            {emptyHint || "Ask a question to begin."}
          </p>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} isLast={i === messages.length - 1} />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message, isLast }: { message: ChatMessage; isLast: boolean }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }
  return <AssistantBubble message={message} isLast={isLast} />;
}

function AssistantBubble({ message, isLast }: { message: ChatMessage; isLast: boolean }) {
  const text = useTypewriter(message.content, isLast);
  return (
    <div className="flex flex-col items-start gap-1">
      <div
        className={cn(
          "max-w-[95%] rounded-2xl rounded-bl-sm border px-3 py-2 text-sm",
          message.error ? "border-destructive/40 bg-destructive/5" : "bg-card",
        )}
      >
        <div className="whitespace-pre-wrap break-words">{text}</div>
      </div>
      {message.architecture && (
        <div className="pl-1">
          <ArchitectureBadge architecture={message.architecture} />
        </div>
      )}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="w-full max-w-[95%]">
          <ToolTrace calls={message.toolCalls} />
        </div>
      )}
    </div>
  );
}

/** Lightweight token-by-token reveal for the most recent assistant message. */
function useTypewriter(full: string, enabled: boolean) {
  const [shown, setShown] = useState(enabled ? "" : full);

  useEffect(() => {
    if (!enabled) {
      setShown(full);
      return;
    }
    setShown("");
    let i = 0;
    const step = Math.max(1, Math.ceil(full.length / 120));
    const timer = setInterval(() => {
      i += step;
      setShown(full.slice(0, i));
      if (i >= full.length) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [full, enabled]);

  return shown;
}
