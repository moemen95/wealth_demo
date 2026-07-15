"use client";

import { ArrowRight, Clock, Info, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/types";

// Models occasionally wrap emphasis in **markdown**; we render plain text, so
// strip the markers rather than show them literally.
const md = (s?: string | null) => (s ? s.replace(/\*\*/g, "").replace(/__/g, "") : s);

/**
 * Renders an insight in the layout its `kind` implies:
 *   basic     — plain title/body/cta
 *   context   — Skills: body + "why this matters" + supporting figures
 *   scenario  — Raw/Agentic: short/long-term timeline, alternatives,
 *               recommended action, and (Agentic) a projection chart.
 *
 * Pass `onSelect` to make the card a clickable entry point into a conversation;
 * omit it (e.g. pinned in the detail view) to render the same content statically.
 */
export function InsightCard({
  insight,
  onSelect,
  index = 0,
  pinned = false,
}: {
  insight: Insight;
  onSelect?: (insight: Insight) => void;
  index?: number;
  pinned?: boolean;
}) {
  const clickable = !!onSelect;

  return (
    <Card
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onSelect!(insight) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect!(insight);
              }
            }
          : undefined
      }
      className={cn(
        "flex h-full flex-col",
        !pinned && "animate-fade-in-up",
        clickable &&
          "cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      style={!pinned ? { animationDelay: `${index * 60}ms` } : undefined}
    >
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <InsightHeader insight={insight} />

        {insight.assumptions && insight.assumptions.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-500/40 dark:bg-amber-500/10">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <Info className="h-3.5 w-3.5" />
              Assuming
            </div>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-800 dark:text-amber-300">
              {insight.assumptions.map((a, i) => (
                <li key={i}>{md(a)}</li>
              ))}
            </ul>
          </div>
        )}

        {insight.body && (
          <p className="text-sm text-muted-foreground">{md(insight.body)}</p>
        )}

        {insight.kind === "context" && <ContextBody insight={insight} />}
        {insight.kind === "scenario" && <ScenarioBody insight={insight} />}

        <RecommendedAction insight={insight} />

        <div className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-medium text-primary">
          {insight.cta || (clickable ? "Discuss this" : "Ask a question")}
          {clickable && <ArrowRight className="h-3.5 w-3.5" />}
        </div>
      </CardContent>
    </Card>
  );
}

function InsightHeader({ insight }: { insight: Insight }) {
  return <h3 className="font-semibold text-foreground">{insight.title}</h3>;
}

function ContextBody({ insight }: { insight: Insight }) {
  return (
    <>
      {insight.context && (
        <div className="rounded-md border bg-muted/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Info className="h-3.5 w-3.5" />
            Why this matters
          </div>
          <p className="text-sm text-muted-foreground">{insight.context}</p>
        </div>
      )}
      {insight.data_points && insight.data_points.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {insight.data_points.map((d, i) => (
            <span
              key={i}
              className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function ScenarioBody({ insight }: { insight: Insight }) {
  if (!insight.short_term && !insight.long_term) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {insight.short_term && (
        <HorizonBlock
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Short term"
          sublabel="next ~12 months"
          text={insight.short_term}
        />
      )}
      {insight.long_term && (
        <HorizonBlock
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Long term"
          sublabel="~5+ years"
          text={insight.long_term}
        />
      )}
    </div>
  );
}

function RecommendedAction({ insight }: { insight: Insight }) {
  if (!insight.recommended_action) return null;
  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Key Summary
      </div>
      <p className="text-sm text-foreground">{md(insight.recommended_action)}</p>
      {insight.recommended_impact && (
        <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Projected impact: {md(insight.recommended_impact)}
        </p>
      )}
    </div>
  );
}

function HorizonBlock({
  icon,
  label,
  sublabel,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  text: string;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
        {icon}
        {label}
        {sublabel && (
          <span className="font-normal text-muted-foreground">· {sublabel}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{md(text)}</p>
    </div>
  );
}
