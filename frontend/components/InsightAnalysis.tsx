"use client";

import { BarChart3, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InsightScenarioChart } from "@/components/InsightScenarioChart";
import { cn, formatCurrency } from "@/lib/utils";
import type { InsightAnalysis as InsightAnalysisData } from "@/lib/types";

/**
 * The Agentic comparison widget: ONE chart comparing all scenarios (deterministic
 * projection computed by the backend), a summary table, and the agent's
 * recommendation of which scenario makes the most sense. Shown above the scenario
 * cards and kept pinned while the user converses about a scenario.
 */
export function InsightAnalysis({
  analysis,
  compact = false,
}: {
  analysis: InsightAnalysisData;
  compact?: boolean;
}) {
  const { series, summary, metric_label, unit, horizon_label } = analysis;

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

        {summary.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">Scenario</th>
                  <th className="py-1.5 px-2 text-right font-medium">{metric_label}</th>
                  <th className="py-1.5 px-2 text-right font-medium">Contributions</th>
                  <th className="py-1.5 pl-2 text-right font-medium">Return</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row, i) => {
                  const recommended = row.scenario === analysis.recommended_scenario;
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
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(row.total_contributions)}
                      </td>
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

        {(analysis.recommended_scenario || analysis.comparison_summary) && (
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
        )}
      </CardContent>
    </Card>
  );
}
