import type { InsightProjection } from "@/lib/types";

/**
 * Best-effort extraction of a plottable time-series from an assistant answer.
 *
 * Agentic answers to "show me X through the years" come back as JSON with an array
 * of `{<label>, <number>}` rows (e.g. `net_worth_by_year: [{year, net_worth_cad}]`).
 * We find the first such array anywhere in the JSON and turn every numeric column
 * into a line, so the chat can render a chart instead of a raw JSON blob. Returns
 * null when the message isn't chartable (then the caller just shows the text).
 */

type Row = Record<string, unknown>;

// Names of the x-axis (time/label) column. EXACT matches are safe for short tokens
// like "t"/"x"; SUBSTR matches are only multi-char words so we don't mistake a value
// column such as "net_worth_cad" (contains "t") for the label.
const TIME_KEYS_EXACT = [
  "t", "x", "yr", "q", "year", "date", "period", "month", "quarter", "time",
  "label", "name", "week", "day",
];
const TIME_KEYS_SUBSTR = ["year", "date", "period", "month", "quarter", "time"];

function tryParse(content: string): unknown {
  const s = content.trim();
  try {
    return JSON.parse(s);
  } catch {
    // The JSON may be wrapped in prose / fences — slice the outermost object/array.
    const candidates = [s.indexOf("{"), s.indexOf("[")].filter((i) => i >= 0);
    if (candidates.length === 0) return null;
    const start = Math.min(...candidates);
    const close = s[start] === "{" ? "}" : "]";
    const end = s.lastIndexOf(close);
    if (end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isRowArray(v: unknown): v is Row[] {
  return (
    Array.isArray(v) &&
    v.length >= 2 &&
    v.every((it) => it != null && typeof it === "object" && !Array.isArray(it))
  );
}

/** Breadth-first search for the first array-of-objects that has a numeric field. */
function findSeriesArray(root: unknown): Row[] | null {
  const queue: unknown[] = [root];
  while (queue.length) {
    const cur = queue.shift();
    if (isRowArray(cur) && Object.values(cur[0]).some((v) => typeof v === "number")) {
      return cur;
    }
    if (Array.isArray(cur)) queue.push(...cur);
    else if (cur && typeof cur === "object") queue.push(...Object.values(cur as Row));
  }
  return null;
}

function pickLabelKey(sample: Row): string | null {
  const keys = Object.keys(sample);
  // 1) A key whose NAME is exactly a time/label token — even if its value is numeric
  //    (e.g. `year: 0`). This is the x-axis.
  for (const lk of TIME_KEYS_EXACT) {
    const hit = keys.find((k) => k.toLowerCase() === lk);
    if (hit) return hit;
  }
  // 2) The first non-numeric key (a string label like "Y0" or "Jan").
  const strKey = keys.find((k) => typeof sample[k] !== "number");
  if (strKey) return strKey;
  // 3) Last resort: a numeric key whose name contains a multi-char time word.
  for (const lk of TIME_KEYS_SUBSTR) {
    const hit = keys.find((k) => k.toLowerCase().includes(lk));
    if (hit) return hit;
  }
  return null;
}

function prettify(key: string): string {
  return key
    .replace(/_(cad|usd|pct|percent)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function findCurrency(root: unknown): string | undefined {
  if (root && typeof root === "object" && !Array.isArray(root)) {
    const v = (root as Row).currency ?? (root as Row).unit;
    if (typeof v === "string") return v;
  }
  return undefined;
}

export function extractChartProjection(content: string): InsightProjection | null {
  if (!content || (!content.includes("{") && !content.includes("["))) return null;
  const root = tryParse(content);
  if (!root) return null;

  const rows = findSeriesArray(root);
  if (!rows) return null;

  const labelKey = pickLabelKey(rows[0]);
  if (!labelKey) return null;

  const numKeys = Object.keys(rows[0]).filter(
    (k) => k !== labelKey && typeof rows[0][k] === "number",
  );

  const series = numKeys
    .map((nk) => ({
      label: prettify(nk),
      points: rows
        .filter((r) => typeof r[nk] === "number")
        .map((r) => ({ t: String(r[labelKey]), value: r[nk] as number })),
    }))
    .filter((s) => s.points.length >= 2);

  if (series.length === 0) return null;

  return {
    unit: findCurrency(root) || "CAD",
    horizon_label: series.length === 1 ? series[0].label : "",
    series,
  };
}
