"use client";

import { useEffect, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { PersonaDetail, PersonaId } from "@/lib/types";

const COLORS = ["#4f46e5", "#0ea5e9", "#14b8a6", "#f59e0b", "#64748b", "#a855f7"];

export function PortfolioChart({ persona }: { persona: PersonaId }) {
  const [detail, setDetail] = useState<PersonaDetail | null>(null);

  useEffect(() => {
    api.getPersona(persona).then(setDetail).catch(() => setDetail(null));
  }, [persona]);

  if (!detail) return null;
  const entries = Object.entries(detail.allocation || {});
  if (entries.length === 0) return null;

  const data = entries.map(([name, value]) => ({ name, value }));

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Asset Allocation</CardTitle>
        <p className="text-sm text-muted-foreground">
          Total portfolio {formatCurrency(detail.portfolio_total)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
