import { cn } from "@/lib/utils";
import type { Architecture } from "@/lib/types";
import { Layers, MessageSquare, Workflow } from "lucide-react";

const META: Record<Architecture, { label: string; icon: typeof Layers; className: string }> = {
  raw: { label: "Raw", icon: MessageSquare, className: "bg-slate-100 text-slate-700 border-slate-200" },
  skills: { label: "Tools", icon: Layers, className: "bg-blue-100 text-blue-700 border-blue-200" },
  agentic: { label: "Intelligent", icon: Workflow, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

export function ArchitectureBadge({
  architecture,
  className,
}: {
  architecture: Architecture;
  className?: string;
}) {
  const m = META[architecture];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        m.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}
