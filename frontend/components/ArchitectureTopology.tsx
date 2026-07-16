"use client";

import { useEffect, useState } from "react";
import { Bot, GitBranch, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ArchAgentInfo, Architecture, ArchTopology } from "@/lib/types";

/**
 * Sidebar panel (under the Financial Snapshot) that reveals the plumbing of the
 * ACTIVE approach: which agents run and which grounded tools each one can call.
 * Data is introspected from the real backend tree via /architectures, so it stays
 * in sync with the code. Reactive to the architecture toggle.
 */
export function ArchitectureTopology({ architecture }: { architecture: Architecture }) {
  const [topos, setTopos] = useState<ArchTopology[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getArchitectures()
      .then((t) => !cancelled && setTopos(t))
      .catch(() => !cancelled && setTopos(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const topo = topos?.find((t) => t.key === architecture);
  if (!topo) return null;

  const toolCount = topo.agents.reduce((n, a) => n + a.tools.length, 0);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Under the hood
          </h2>
          <span className="ml-auto text-[11px] font-medium text-muted-foreground">
            {topo.agents.length > 0
              ? `${topo.agents.length} agent${topo.agents.length > 1 ? "s" : ""} · ${toolCount} tool${toolCount === 1 ? "" : "s"}`
              : "no tools"}
          </span>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">{topo.label}</p>
          <p className="text-xs text-muted-foreground">{topo.tagline}</p>
        </div>

        {topo.agents.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 p-2.5 text-xs text-muted-foreground">
            {topo.note}
          </p>
        ) : (
          <div className="space-y-2.5">
            {topo.agents.map((agent) => (
              <AgentRow key={agent.name} agent={agent} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AgentRow({ agent }: { agent: ArchAgentInfo }) {
  const Icon = agent.kind === "orchestrator" ? GitBranch : agent.kind === "runtime" ? Wrench : Bot;
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-xs font-medium text-foreground">{prettyAgent(agent.name)}</span>
        <span
          className={cn(
            "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            agent.kind === "orchestrator"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {agent.kind}
        </span>
      </div>
      {agent.tools.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {agent.tools.map((t) => (
            <span
              key={t.name}
              title={t.description || t.name}
              className="rounded border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {t.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] italic text-muted-foreground">routes to sub-agents</p>
      )}
    </div>
  );
}

function prettyAgent(name: string): string {
  return name.replace(/_/g, " ").replace(/\bagent\b/i, "agent");
}
