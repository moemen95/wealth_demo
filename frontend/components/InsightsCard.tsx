"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AgenticDiscovery } from "@/components/AgenticDiscovery";
import { InsightCard } from "@/components/InsightCard";
import { ToolTrace } from "@/components/ToolTrace";
import { api } from "@/lib/api";
import type {
  AgenticDiscovery as AgenticDiscoveryData,
  Architecture,
  Insight,
  InsightsResponse,
  PersonaId,
} from "@/lib/types";

export function InsightsCards({
  persona,
  architecture,
  onSelect,
  compact = false,
  sessionId,
  onClearMemory,
}: {
  persona: PersonaId;
  architecture: Architecture;
  onSelect: (insight: Insight) => void;
  compact?: boolean;
  /** When set with architecture="agentic", enables the interactive discovery flow. */
  sessionId?: string;
  onClearMemory?: () => void;
}) {
  const interactive = architecture === "agentic" && !!sessionId;
  if (interactive) {
    return (
      <AgenticInsights
        persona={persona}
        sessionId={sessionId!}
        onSelect={onSelect}
        compact={compact}
        onClearMemory={onClearMemory}
      />
    );
  }
  return (
    <StaticInsights
      persona={persona}
      architecture={architecture}
      onSelect={onSelect}
      compact={compact}
    />
  );
}

/** Direct, stateless fetch — Raw, Skills, and Agentic on /compare. */
function StaticInsights({
  persona,
  architecture,
  onSelect,
  compact,
}: {
  persona: PersonaId;
  architecture: Architecture;
  onSelect: (insight: Insight) => void;
  compact: boolean;
}) {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    api
      .getInsights(persona, architecture)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [persona, architecture]);

  return (
    <section>
      <Header loading={loading} timingMs={data?.timing_ms} />
      <InsightGrid
        loading={loading}
        insights={data?.insights}
        onSelect={onSelect}
        compact={compact}
      />
      {data && <ToolTrace calls={data.tool_calls} />}
    </section>
  );
}

type Phase = "loading-discovery" | "discovery" | "saving" | "insights";

/** Interactive Agentic flow: discovery → context memory → tailored insights. */
function AgenticInsights({
  persona,
  sessionId,
  onSelect,
  compact,
  onClearMemory,
}: {
  persona: PersonaId;
  sessionId: string;
  onSelect: (insight: Insight) => void;
  compact: boolean;
  onClearMemory?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading-discovery");
  const [discovery, setDiscovery] = useState<AgenticDiscoveryData | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [followUp, setFollowUp] = useState("");
  const runId = useRef(0);

  const fetchInsights = useCallback(
    async (rid: number) => {
      setPhase("saving");
      try {
        const d = await api.getInsights(persona, "agentic", sessionId);
        if (runId.current === rid) {
          setInsights(d);
          setPhase("insights");
        }
      } catch {
        if (runId.current === rid) setPhase("insights");
      }
    },
    [persona, sessionId],
  );

  // Start (or restart, e.g. after Clear memory) with a discovery request.
  useEffect(() => {
    const rid = ++runId.current;
    setPhase("loading-discovery");
    setDiscovery(null);
    setInsights(null);
    setFollowUp("");
    api
      .agenticDiscovery(persona, sessionId)
      .then((d) => {
        if (runId.current !== rid) return;
        if (d.needs_context) {
          setDiscovery(d);
          setPhase("discovery");
        } else {
          fetchInsights(rid);
        }
      })
      .catch(() => {
        if (runId.current === rid) setPhase("discovery");
      });
  }, [persona, sessionId, fetchInsights]);

  const answer = useCallback(
    async (text: string, declined: boolean) => {
      const rid = ++runId.current;
      setPhase("saving");
      try {
        const res = await api.agenticContext({
          persona_id: persona,
          session_id: sessionId,
          answer: text,
          declined,
        });
        if (runId.current !== rid) return;
        setFollowUp(res.follow_up || "");
      } catch {
        /* ignore — still try to render insights */
      }
      if (runId.current === rid) await fetchInsights(rid);
    },
    [persona, sessionId, fetchInsights],
  );

  const busy = phase === "loading-discovery" || phase === "saving";

  return (
    <section>
      <Header
        loading={busy}
        timingMs={phase === "insights" ? insights?.timing_ms : undefined}
        onClearMemory={onClearMemory}
      />

      {phase === "loading-discovery" && (
        <Card className="animate-pulse">
          <CardContent className="space-y-2 p-4">
            <div className="h-3 w-1/3 rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-8 w-full rounded bg-muted" />
          </CardContent>
        </Card>
      )}

      {phase === "discovery" && discovery && (
        <AgenticDiscovery
          question={discovery.question}
          options={discovery.options}
          onAnswer={answer}
          compact={compact}
        />
      )}

      {(phase === "saving" || phase === "insights") && (
        <>
          {phase === "insights" && followUp && (
            <div className="mb-3">
              <AgenticDiscovery
                question={followUp}
                options={[]}
                onAnswer={answer}
                compact
              />
            </div>
          )}
          <InsightGrid
            loading={phase === "saving"}
            insights={insights?.insights}
            onSelect={onSelect}
            compact={compact}
          />
          {phase === "insights" && insights && (
            <ToolTrace calls={insights.tool_calls} />
          )}
        </>
      )}
    </section>
  );
}

function Header({
  loading,
  timingMs,
  onClearMemory,
}: {
  loading: boolean;
  timingMs?: number;
  onClearMemory?: () => void;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
      <Lightbulb className="h-4 w-4" />
      Insights
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      <div className="ml-auto flex items-center gap-2">
        {timingMs != null && <span className="text-xs font-normal">{timingMs} ms</span>}
        {onClearMemory && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearMemory}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear memory
          </Button>
        )}
      </div>
    </div>
  );
}

function InsightGrid({
  loading,
  insights,
  onSelect,
  compact,
}: {
  loading: boolean;
  insights?: Insight[];
  onSelect: (insight: Insight) => void;
  compact: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "grid grid-cols-1 gap-3"
          : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      }
    >
      {loading &&
        [0, 1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="space-y-2 p-4">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-4/5 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}

      {!loading &&
        insights?.map((ins, i) => (
          <InsightCard key={i} insight={ins} index={i} onSelect={onSelect} />
        ))}
    </div>
  );
}
