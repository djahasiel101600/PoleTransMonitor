import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import type { Reading } from "../types";

type Metric = "voltage" | "current" | "apparent_power" | "oil_temp";

const METRIC_CONFIG: Record<
  Metric,
  { label: string; color: string; unit: string }
> = {
  voltage: { label: "Voltage", color: "#0d9488", unit: "V" },
  current: { label: "Current", color: "#6366f1", unit: "A" },
  apparent_power: { label: "Power", color: "#f59e0b", unit: "VA" },
  oil_temp: { label: "Oil Temp", color: "#ef4444", unit: "°C" },
};

const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
};
const TOOLTIP_LABEL_STYLE = { color: "var(--color-foreground)" };

export function ReportsChart({ readings }: { readings: Reading[] }) {
  const [visible, setVisible] = useState<Record<Metric, boolean>>({
    voltage: true,
    current: true,
    apparent_power: false,
    oil_temp: false,
  });

  const chartData = useMemo(
    () =>
      [...readings]
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        )
        .map((r) => ({
          time: r.timestamp,
          voltage: r.voltage,
          current: r.current,
          apparent_power: r.apparent_power,
          oil_temp: r.oil_temp,
        })),
    [readings],
  );

  const stats = useMemo(() => {
    if (!readings.length) return null;
    let sumV = 0,
      sumI = 0,
      maxI = 0,
      sumPF = 0,
      cntV = 0,
      cntI = 0,
      cntPF = 0;
    for (const r of readings) {
      if (r.voltage != null) {
        sumV += r.voltage;
        cntV++;
      }
      if (r.current != null) {
        sumI += r.current;
        cntI++;
        if (r.current > maxI) maxI = r.current;
      }
      if (r.power_factor != null) {
        sumPF += r.power_factor;
        cntPF++;
      }
    }
    return {
      count: readings.length,
      avgVoltage: cntV ? (sumV / cntV).toFixed(1) : "—",
      avgCurrent: cntI ? (sumI / cntI).toFixed(2) : "—",
      peakCurrent: cntI ? maxI.toFixed(2) : "—",
      avgPF: cntPF ? (sumPF / cntPF).toFixed(3) : "—",
    };
  }, [readings]);

  const toggleMetric = (m: Metric) =>
    setVisible((prev) => ({ ...prev, [m]: !prev[m] }));

  if (!readings.length) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Apply filters to view chart data.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-semibold">Trend Analysis</CardTitle>
        <div className="flex flex-wrap gap-2">
          {(
            Object.entries(METRIC_CONFIG) as [
              Metric,
              (typeof METRIC_CONFIG)[Metric],
            ][]
          ).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleMetric(key)}
              className={[
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                visible[key]
                  ? "border-transparent text-white"
                  : "border-border/80 bg-background text-muted-foreground",
              ].join(" ")}
              style={visible[key] ? { backgroundColor: cfg.color } : undefined}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        {stats && (
          <div className="mb-4 flex flex-wrap gap-3">
            <StatPill label="Readings" value={stats.count.toLocaleString()} />
            <StatPill label="Avg Voltage" value={`${stats.avgVoltage} V`} />
            <StatPill label="Avg Current" value={`${stats.avgCurrent} A`} />
            <StatPill label="Peak Current" value={`${stats.peakCurrent} A`} />
            <StatPill label="Avg PF" value={stats.avgPF} />
          </div>
        )}

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
              />
              <XAxis
                dataKey="time"
                tickFormatter={fmtTime}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                stroke="var(--color-border)"
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                stroke="var(--color-border)"
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
              />
              <Legend />
              {(
                Object.entries(METRIC_CONFIG) as [
                  Metric,
                  (typeof METRIC_CONFIG)[Metric],
                ][]
              ).map(([key, cfg]) =>
                visible[key] ? (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={`${cfg.label} (${cfg.unit})`}
                    stroke={cfg.color}
                    dot={false}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                  />
                ) : null,
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtTime(t: string) {
  const d = new Date(t);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1">
      <span className="text-[11px] text-muted-foreground">{label}: </span>
      <span className="text-[11px] font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}
