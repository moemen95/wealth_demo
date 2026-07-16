"use client";

import { BarChart3, CheckCircle2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InsightScenarioChart } from "@/components/InsightScenarioChart";
import { cn, formatCurrency } from "@/lib/utils";
import type { InsightAnalysis as InsightAnalysisData } from "@/lib/types";

/**
 * The Agentic comparison widget: ONE chart comparing all scenarios (deterministic
 * projection computed by the backend), a blended read-the-chart + table block, and
 * — only once context is sufficient — the agent's recommendation. Kept pinned while
 * the user converses about a scenario.
 *
 * `preliminary` = the agent still wants more context (a follow-up is pending), so we
 * withhold the "which makes more sense" recommendation rather than commit to one.
 */
export function InsightAnalysis({
  analysis,
  compact = false,
  preliminary = false,
}: {
  analysis: InsightAnalysisData;
  compact?: boolean;
  preliminary?: boolean;
}) {
  const { series, summary, metric_label, unit, horizon_label } = analysis;
  // A retiree drawing income contributes nothing — drop the empty column.
  const showContributions = summary.some((r) => (r.total_contributions ?? 0) > 0);

  return (
    <Card className="border-primary/30">
      <CardContent className={compact ? "space-y-3 p-3" : "space-y-4 p-4"}>
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BarChart3 className="h-4 w-4 text-primary" />
          Scenario comparison
          {horizon_label && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {horizon_label}
            </span>
          )}
        </div>

        {series.length > 0 && (
          <InsightScenarioChart
            projection={{ unit, horizon_label: metric_label, series }}
          />
        )}

        {/* The read-the-chart explainer and the scenario table are one blended
            block: the explanation reads as the caption for the numbers below it. */}
        {(analysis.chart_explanation || summary.length > 0) && (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            {analysis.chart_explanation && (
              <p className="text-sm leading-relaxed text-foreground">
                {analysis.chart_explanation}
              </p>
            )}
            {summary.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-1.5 pr-2 font-medium">Scenario</th>
                      <th className="py-1.5 px-2 text-right font-medium">{metric_label}</th>
                      {showContributions && (
                        <th className="py-1.5 px-2 text-right font-medium">Contributions</th>
                      )}
                      <th className="py-1.5 pl-2 text-right font-medium">Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row, i) => {
                      const recommended =
                        !preliminary && row.scenario === analysis.recommended_scenario;
                      return (
                        <tr
                          key={i}
                          className={cn(
                            "border-b last:border-0",
                            recommended && "bg-primary/5",
                          )}
                        >
                          <td className="py-1.5 pr-2 font-medium text-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              {recommended && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                              )}
                              {row.scenario}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right tabular-nums text-foreground">
                            {formatCurrency(row.final_value)}
                          </td>
                          {showContributions && (
                            <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                              {formatCurrency(row.total_contributions)}
                            </td>
                          )}
                          <td className="py-1.5 pl-2 text-right tabular-nums text-muted-foreground">
                            {row.cagr != null ? `${(row.cagr * 100).toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Only commit to a recommendation once we're not still gathering context. */}
        {preliminary ? (
          <div className="flex items-start gap-1.5 rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              These scenarios are a first pass. Answer the question below and I&apos;ll
              recommend the one that fits you best.
            </span>
          </div>
        ) : (
          (analysis.recommended_scenario || analysis.comparison_summary) && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
              {analysis.recommended_scenario && (
                <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  Which makes more sense: {analysis.recommended_scenario}
                </div>
              )}
              {analysis.recommendation_rationale && (
                <p className="text-sm text-foreground">{analysis.recommendation_rationale}</p>
              )}
              {analysis.comparison_summary && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {analysis.comparison_summary}
                </p>
              )}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
