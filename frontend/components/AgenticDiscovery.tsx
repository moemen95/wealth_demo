"use client";

import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The Agentic "ask before advising" step: the context subagent's question plus
 * scenario chips and a free-text box. Picking a chip or submitting text calls
 * onAnswer(answer, false); "Skip" calls onAnswer("", true) so the backend records
 * the decline and later states its assumptions.
 */
export function AgenticDiscovery({
  question,
  options,
  onAnswer,
  disabled = false,
  compact = false,
}: {
  question: string;
  options: string[];
  onAnswer: (answer: string, declined: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onAnswer(t, false);
    setText("");
  };

  return (
    <Card>
      <CardContent className={compact ? "space-y-3 p-3" : "space-y-4 p-5"}>
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Before I tailor your insights
            </p>
            <p className="mt-0.5 font-medium text-foreground">{question}</p>
          </div>
        </div>

        {options.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => (
              <button
                key={o}
                onClick={() => !disabled && onAnswer(o, false)}
                disabled={disabled}
                className="rounded-full border bg-card px-3 py-1 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                {o}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="…or describe your goal in your own words"
            disabled={disabled}
            className="flex-1 rounded-md border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <Button onClick={submit} disabled={disabled || !text.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <button
          onClick={() => !disabled && onAnswer("", true)}
          disabled={disabled}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
        >
          Skip — I&apos;m not sure yet
        </button>
      </CardContent>
    </Card>
  );
}
