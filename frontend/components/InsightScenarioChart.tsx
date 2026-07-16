"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { InsightProjection } from "@/lib/types";

// Shared with FinancialSnapshot so charts across the app read as one system.
const COLORS = ["#4f46e5", "#0ea5e9", "#14b8a6", "#f59e0b", "#64748b", "#a855f7"];

/**
 * Renders an Agentic scenario's projection: one line per alternative over the
 * horizon. Series carry their own point lists (possibly different `t` labels),
 * so we merge them into a single row-per-`t` dataset keyed by series label.
 */
export function InsightScenarioChart({ projection }: { projection: InsightProjection }) {
  const series = projection.series ?? [];
  if (series.length === 0) return null;

  // Preserve first-seen order of the x labels across all series.
  const ticks: string[] = [];
  for (const s of series) {
    for (const p of s.points) if (!ticks.includes(p.t)) ticks.push(p.t);
  }

  const data = ticks.map((t) => {
    const row: Record<string, string | number> = { t };
    for (const s of series) {
      const pt = s.points.find((p) => p.t === t);
      if (pt) row[s.label] = pt.value;
    }
    return row;
  });

  const isCurrency = (projection.unit || "CAD").toUpperCase() === "CAD";
  const fmt = (v: number) => (isCurrency ? formatCurrency(v) : `${v} ${projection.unit}`);

  return (
    <div className="mt-3">
      {projection.horizon_label && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {projection.horizon_label}
        </p>
      )}
      {/* min-w-0 + overflow-hidden keep the chart (and its legend, which carries
          long scenario names) from forcing the page wider than the viewport. */}
      <div className="h-52 w-full min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
            <XAxis dataKey="t" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              width={54}
              tickFormatter={(v: number) =>
                isCurrency ? `$${Math.round(v / 1000)}k` : String(v)
              }
            />
            <Tooltip
              formatter={(v: number) => fmt(v)}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              // Scenario titles are long; truncate so the legend never overflows.
              formatter={(value: string) =>
                value.length > 26 ? `${value.slice(0, 25)}…` : value
              }
            />
            {series.map((s, i) => (
              <Line
                key={s.label}
                type="monotone"
                dataKey={s.label}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
