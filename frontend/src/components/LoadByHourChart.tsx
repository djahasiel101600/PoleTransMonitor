import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { fetchReadings } from "../api/client";
import type { Reading } from "../types";

const CHART_MARGIN = { top: 8, right: 16, left: 0, bottom: 8 };

function bucketByHour(
  readings: Reading[],
  hours: 24 | 168,
): { hour: string; loadKva: number; count: number }[] {
  const buckets = Array.from({ length: hours }, (_, i) => ({
    hour: hours === 24 ? `${i}h` : `${i}h`,
    loadKva: 0,
    count: 0,
  }));
  for (const r of readings) {
    const ap = r.apparent_power;
    if (ap == null || Number.isNaN(ap)) continue;
    const d = new Date(r.timestamp);
    const idx = hours === 24 ? d.getHours() : d.getDay() * 24 + d.getHours();
    if (idx >= 0 && idx < hours) {
      buckets[idx].loadKva += ap / 1000;
      buckets[idx].count += 1;
    }
  }
  for (const b of buckets) {
    if (b.count > 0) b.loadKva = b.loadKva / b.count;
  }
  return buckets;
}

type Period = "24h" | "7d";

export function LoadByHourChart({
  transformerId,
}: {
  transformerId: number | null;
}) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("24h");

  useEffect(() => {
    if (transformerId == null) return;
    queueMicrotask(() => setLoading(true));
    const ms = period === "7d" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - ms).toISOString();
    fetchReadings(transformerId, since)
      .then((r) => setReadings(r))
      .catch((e) => console.error("LoadByHourChart:", e))
      .finally(() => setLoading(false));
  }, [transformerId, period]);

  const data = useMemo<
    Array<{ hour?: string; day?: string; loadKva: number; count: number }>
  >(() => {
    if (period === "24h") {
      const b = bucketByHour(readings, 24);
      return b.map((d, i) => ({ ...d, hour: `${i}:00`, day: undefined }));
    }
    const b = bucketByHour(readings, 168);
    const byDay: { day: string; loadKva: number; count: number }[] = [];
    for (let day = 0; day < 7; day++) {
      let sum = 0;
      let n = 0;
      for (let h = 0; h < 24; h++) {
        const v = b[day * 24 + h];
        if (v.count > 0) {
          sum += v.loadKva;
          n += 1;
        }
      }
      byDay.push({
        day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day],
        loadKva: n > 0 ? sum / n : 0,
        count: n,
      });
    }
    return byDay.map((d) => ({ ...d, hour: undefined }));
  }, [readings, period]);

  if (transformerId == null) return null;

  if (loading) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[clamp(10rem,35vh,18rem)] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.some((d) => d.loadKva > 0);

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">
          Load by {period === "24h" ? "hour" : "day"}
        </CardTitle>
        <div className="flex gap-0.5 rounded-md border border-border/80 p-0.5">
          <button
            type="button"
            onClick={() => setPeriod("24h")}
            className={`rounded px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${period === "24h" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            24h
          </button>
          <button
            type="button"
            onClick={() => setPeriod("7d")}
            className={`rounded px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${period === "7d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            7d
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[clamp(10rem,35vh,18rem)] items-center justify-center text-sm text-muted-foreground">
            No load data for this period
          </div>
        ) : (
          <div className="h-[clamp(10rem,35vh,18rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CHART_MARGIN}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey={period === "24h" ? "hour" : "day"}
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  tickFormatter={(v) => `${v} kVA`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => {
                    const v = typeof value === "number" ? value : 0;
                    return [`${v.toFixed(2)} kVA`, "Avg load"];
                  }}
                  labelFormatter={(label) =>
                    period === "24h" ? `Hour ${label}` : label
                  }
                />
                <Bar
                  dataKey="loadKva"
                  name="Load (kVA)"
                  fill="var(--color-primary)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
