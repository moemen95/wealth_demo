export type Architecture = "raw" | "skills" | "agentic";
export type PersonaId = "first" | "middle" | "affluent";

export interface PersonaSummary {
  persona_id: PersonaId;
  name: string;
  age: number;
  tagline: string;
  risk_profile: string;
  portfolio_total: number;
  monthly_income: number;
  monthly_expenses: number;
}

export interface Debt {
  type: string;
  balance: number;
  rate?: number | null;
}

export interface NetWorth {
  cash: number;
  investments: number;
  debt: number;
  net_worth: number;
  debts: Debt[];
  allocation: Record<string, number>;
}

export interface PersonaDetail extends PersonaSummary {
  accounts: Record<string, number>;
  allocation: Record<string, number>;
  goals: string[];
  upcoming_events: Array<Record<string, unknown>>;
  advisor: string | null;
  debts: Debt[];
  net_worth: NetWorth | null;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

export type InsightKind = "basic" | "context" | "scenario";

export interface InsightAlternative {
  label: string;
  detail: string;
  tradeoff?: string | null;
  recommended: boolean;
}

export interface InsightSeriesPoint {
  t: string;
  value: number;
}

export interface InsightSeries {
  label: string;
  points: InsightSeriesPoint[];
}

export interface InsightProjection {
  unit: string;
  horizon_label: string;
  series: InsightSeries[];
}

export interface Insight {
  kind: InsightKind;
  title: string;
  body: string;
  cta: string;
  // Skills ("context")
  context?: string | null;
  data_points?: string[] | null;
  // Agentic: assumptions stated when the client declined to share goals
  assumptions?: string[] | null;
  // Raw + Agentic ("scenario")
  short_term?: string | null;
  long_term?: string | null;
  alternatives?: InsightAlternative[] | null;
  recommended_action?: string | null;
  recommended_impact?: string | null;
  grounded?: boolean | null;
  follow_up_questions?: string[] | null;
  projection?: InsightProjection | null;
}

export interface InsightAnalysisRow {
  scenario: string;
  final_value: number;
  total_contributions: number;
  cagr?: number | null;
  note?: string | null;
}

export interface InsightAnalysis {
  metric_label: string;
  unit: string;
  horizon_label: string;
  series: InsightSeries[];
  summary: InsightAnalysisRow[];
  chart_explanation?: string | null;
  recommended_scenario?: string | null;
  recommendation_rationale?: string | null;
  comparison_summary?: string | null;
}

export interface InsightsResponse {
  architecture: Architecture;
  provider: string;
  persona_id: PersonaId;
  insights: Insight[];
  analysis?: InsightAnalysis | null;
  tool_calls: ToolCall[];
  timing_ms: number;
  error: string | null;
}

export interface ChatResponse {
  reply: string;
  provider: string;
  architecture: Architecture;
  session_id: string;
  tool_calls: ToolCall[];
  timing_ms: number;
  error: string | null;
}

export interface AgenticDiscovery {
  needs_context: boolean;
  question: string;
  options: string[];
  stored_context: string | null;
  timing_ms: number;
  error: string | null;
}

export interface AgenticContextResult {
  follow_up: string;
  stored_context: string;
  declined: boolean;
  timing_ms: number;
  error: string | null;
}

export interface AgenticMemoryEntry {
  context: string;
  declined: boolean;
}

export interface AgenticMemory {
  client_context: string;
  declined: boolean;
  entries: AgenticMemoryEntry[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  provider?: string;
  architecture?: Architecture;
  timingMs?: number;
  error?: string | null;
}

export interface ArchToolInfo {
  name: string;
  description?: string;
}

export interface ArchAgentInfo {
  name: string;
  kind: "orchestrator" | "subagent" | "runtime";
  tools: ArchToolInfo[];
}

export interface ArchTopology {
  key: Architecture;
  label: string;
  tagline: string;
  note?: string;
  agents: ArchAgentInfo[];
}

export const ARCHITECTURES: { id: Architecture; label: string; blurb: string }[] = [
  { id: "raw", label: "Raw", blurb: "Prompt only — no grounding" },
  { id: "skills", label: "Skills", blurb: "Structured tools, single-shot" },
  // `id` stays "agentic" (the backend contract); only the display label changes.
  { id: "agentic", label: "Intelligent", blurb: "Planner + subagents + memory" },
];
