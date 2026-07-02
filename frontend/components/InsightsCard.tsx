"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Lightbulb, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ToolTrace } from "@/components/ToolTrace";
import { api } from "@/lib/api";
import type { Architecture, InsightsResponse, PersonaId } from "@/lib/types";

export function InsightsCards({
  persona,
  architecture,
}: {
  persona: PersonaId;
  architecture: Architecture;
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
        Initial Insights
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {data && (
          <span className="ml-auto text-xs font-normal">{data.timing_ms} ms</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            <Card
              key={i}
              className="animate-fade-in-up transition-shadow hover:shadow-md"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <CardContent className="flex h-full flex-col p-4">
                <h3 className="font-semibold text-foreground">{ins.title}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{ins.body}</p>
                <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {ins.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {data && <ToolTrace calls={data.tool_calls} />}
    </section>
  );
}
