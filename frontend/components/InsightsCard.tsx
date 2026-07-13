"use client";

import { useEffect, useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InsightCard } from "@/components/InsightCard";
import { ToolTrace } from "@/components/ToolTrace";
import { api } from "@/lib/api";
import type { Architecture, Insight, InsightsResponse, PersonaId } from "@/lib/types";

export function InsightsCards({
  persona,
  architecture,
  onSelect,
  compact = false,
}: {
  persona: PersonaId;
  architecture: Architecture;
  onSelect: (insight: Insight) => void;
  compact?: boolean;
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
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Lightbulb className="h-4 w-4" />
        Insights
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {data && (
          <span className="ml-auto text-xs font-normal">{data.timing_ms} ms</span>
        )}
      </div>

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
          data?.insights.map((ins, i) => (
            <InsightCard key={i} insight={ins} index={i} onSelect={onSelect} />
          ))}
      </div>

      {data && <ToolTrace calls={data.tool_calls} />}
    </section>
  );
}
