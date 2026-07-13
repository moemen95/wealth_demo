"use client";

import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Banknote, CreditCard, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import type { PersonaDetail, PersonaId } from "@/lib/types";

// Shared palette so every chart in the app reads as one system.
const COLORS = ["#4f46e5", "#0ea5e9", "#14b8a6", "#f59e0b", "#64748b", "#a855f7"];

const DEBT_LABELS: Record<string, string> = {
  credit_card: "Credit card",
  student_loan: "Student loan",
  mortgage: "Mortgage",
  loan: "Loan",
  line_of_credit: "Line of credit",
};

const prettyDebt = (type: string) =>
  DEBT_LABELS[type] ??
  type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * The client's ground-truth financial picture: net worth headline, a
 * cash / investments / debt breakdown, and an allocation donut when there are
 * holdings. Sourced from GET /personas/{id} so the same figures appear on the
 * home sidebar and the compare page.
 */
export function FinancialSnapshot({ persona }: { persona: PersonaId }) {
  const [detail, setDetail] = useState<PersonaDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    api
      .getPersona(persona)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setDetail(null));
    return () => {
      cancelled = true;
    };
  }, [persona]);

  if (!detail || !detail.net_worth) return null;
  const nw = detail.net_worth;

  const allocationEntries = Object.entries(nw.allocation || {});
  const donutData = allocationEntries.map(([name, value]) => ({ name, value }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Financial Snapshot</CardTitle>
        <p className="text-sm text-muted-foreground">
          Net worth{" "}
          <span
            className={cn(
              "font-semibold",
              nw.net_worth < 0 ? "text-destructive" : "text-foreground",
            )}
          >
            {formatCurrency(nw.net_worth)}
          </span>
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Row
            icon={<Wallet className="h-3.5 w-3.5" />}
            label="Cash"
            value={nw.cash}
          />
          <Row
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Investments"
            value={nw.investments}
          />
          {nw.debts.length === 0 && nw.debt === 0 && (
            <Row
              icon={<CreditCard className="h-3.5 w-3.5" />}
              label="Debt"
              value={0}
            />
          )}
          {nw.debts.map((d, i) => (
            <Row
              key={i}
              icon={<CreditCard className="h-3.5 w-3.5" />}
              label={prettyDebt(d.type)}
              value={-d.balance}
              negative
            />
          ))}
        </div>

        {donutData.length > 0 && (
          <div>
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Banknote className="h-3.5 w-3.5" />
              Asset allocation
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v)}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-0.5 text-xs">
              {donutData.map((d, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="ml-auto font-medium text-foreground">
                    {formatCurrency(d.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  icon,
  label,
  value,
  negative = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "ml-auto font-medium tabular-nums",
          negative ? "text-destructive" : "text-foreground",
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
