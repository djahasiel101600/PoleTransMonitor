import { useEffect, useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { fetchReadings } from "../api/client";
import type { Reading, Transformer } from "../types";

type ConditionLevel = "normal" | "warning" | "critical";

function classifyReading(r: Reading, t: Transformer | null): ConditionLevel {
  const nominalV = t?.nominal_voltage ?? 220;
  const ratedA = t?.rated_current ?? 100;
  const ratedVa = t ? t.rated_kva * 1000 : 15000;
  const nominalF = t?.nominal_freq ?? 50;

  let worst: ConditionLevel = "normal";

  if (r.voltage != null && !Number.isNaN(r.voltage)) {
    const low = nominalV * 0.93;
    const high = nominalV * 1.07;
    if (r.voltage < low || r.voltage > high) worst = "critical";
  }
  if (r.current != null && !Number.isNaN(r.current)) {
    const pct = (r.current / ratedA) * 100;
    if (pct > 125) worst = "critical";
    else if (pct > 100 && worst === "normal") worst = "warning";
  }
  if (r.apparent_power != null && !Number.isNaN(r.apparent_power)) {
    const pct = (r.apparent_power / ratedVa) * 100;
    if (pct > 125) worst = "critical";
    else if (pct > 100 && worst === "normal") worst = "warning";
  }
  if (r.power_factor != null && !Number.isNaN(r.power_factor)) {
    if (r.power_factor < 0.7) worst = "critical";
    else if (r.power_factor < 0.85 && worst === "normal") worst = "warning";
  }
  if (r.frequency != null && !Number.isNaN(r.frequency)) {
    const diff = Math.abs(r.frequency - nominalF);
    if (diff > 2) worst = "critical";
    else if (diff > 1 && worst === "normal") worst = "warning";
  }
  return worst;
}

const COLORS: Record<ConditionLevel, string> = {
  normal: "var(--color-primary)",
  warning: "var(--color-warning)",
  critical: "var(--color-critical)",
};

export function ConditionDonut({
  transformerId,
  transformer,
}: {
  transformerId: number | null;
  transformer: Transformer | null;
}) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transformerId == null) return;
    queueMicrotask(() => setLoading(true));
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    fetchReadings(transformerId, since)
      .then(setReadings)
      .catch((e) => console.error("ConditionDonut:", e))
      .finally(() => setLoading(false));
  }, [transformerId]);

  const data = useMemo(() => {
    const counts: Record<ConditionLevel, number> = {
      normal: 0,
      warning: 0,
      critical: 0,
    };
    for (const r of readings) {
      counts[classifyReading(r, transformer)] += 1;
    }
    return [
      { name: "Normal", value: counts.normal, level: "normal" as const },
      { name: "Warning", value: counts.warning, level: "warning" as const },
      { name: "Critical", value: counts.critical, level: "critical" as const },
    ].filter((d) => d.value > 0);
  }, [readings, transformer]);

  if (transformerId == null) return null;

  if (loading) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[clamp(12rem,28vh,16rem)] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="border-border/80 shadow-none overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Condition (24h)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Share of readings in Normal / Warning / Critical
        </p>
      </CardHeader>
      <CardContent className="overflow-hidden">
        {total === 0 ? (
          <div className="flex h-[clamp(12rem,28vh,16rem)] items-center justify-center text-sm text-muted-foreground">
            No readings in the last 24h
          </div>
        ) : (
          <div className="h-[clamp(12rem,28vh,16rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  isAnimationActive={false}
                  labelLine={false}
                  // Position labels inside the donut so they don't get clipped.
                  label={(props) => {
                    const {
                      cx,
                      cy,
                      innerRadius,
                      outerRadius,
                      midAngle,
                      value,
                    } = props as {
                      cx: number;
                      cy: number;
                      innerRadius: number;
                      outerRadius: number;
                      midAngle: number;
                      value: number;
                    };

                    if (value <= 0) return null;
                    const percent = (value / total) * 100;

                    // Slightly tighter for small slices so "1%" stays visible.
                    const radius =
                      innerRadius +
                      (outerRadius - innerRadius) * (percent < 5 ? 0.38 : 0.45);
                    const RAD = Math.PI / 180;
                    const x = cx + radius * Math.cos(-midAngle * RAD);
                    const y = cy + radius * Math.sin(-midAngle * RAD);
                    const textAnchor = x >= cx ? "start" : "end";
                    const fontSize = percent < 5 ? 10 : 11;

                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor={textAnchor}
                        dominantBaseline="central"
                        style={{ fill: "var(--color-foreground)", fontSize }}
                        pointerEvents="none"
                      >
                        {percent.toFixed(0)}%
                      </text>
                    );
                  }}
                >
                  {data.map((entry) => (
                    <Cell key={entry.level} fill={COLORS[entry.level]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => {
                    const v = typeof value === "number" ? value : 0;
                    return [
                      `${v} (${((v / total) * 100).toFixed(1)}%)`,
                      "Readings",
                    ];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
