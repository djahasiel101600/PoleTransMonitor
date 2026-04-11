import { useEffect, useState, useCallback, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { fetchReadings } from "../api/client";
import { useMonitorWebSocket } from "../hooks/useMonitorWebSocket";
import type { Reading } from "../types";

type TimeRange = "1h" | "6h" | "24h";

const TIME_RANGES: { value: TimeRange; label: string; ms: number }[] = [
  { value: "1h", label: "1 h", ms: 60 * 60 * 1000 },
  { value: "6h", label: "6 h", ms: 6 * 60 * 60 * 1000 },
  { value: "24h", label: "24 h", ms: 24 * 60 * 60 * 1000 },
];

const CHART_MARGIN = { top: 5, right: 20, left: 0, bottom: 5 };
const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
};
const TOOLTIP_LABEL_STYLE = { color: "var(--color-foreground)" };

function isValidNum(v: number | null | undefined): v is number {
  return v != null && !Number.isNaN(v) && isFinite(v);
}

function formatTime(t: string) {
  return new Date(t).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTooltipTime(t: string) {
  return new Date(t).toLocaleString();
}

type ReadingKey = keyof Reading;

interface SingleMetricChartProps {
  transformerId: number | null;
  title: string;
  dataKey: ReadingKey;
  unit: string;
  color: string;
  yDomain?: [number | "auto", number | "auto"];
  validRange?: { min: number; max: number };
}

export function SingleMetricChart({
  transformerId,
  title,
  dataKey,
  unit,
  color,
  yDomain,
  validRange,
}: SingleMetricChartProps) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  const { reading: wsReading, connected } = useMonitorWebSocket(transformerId);

  const rangeMs = TIME_RANGES.find((r) => r.value === timeRange)!.ms;
  const trimToRange = useCallback(
    (list: Reading[]) => {
      const cutoff = Date.now() - rangeMs;
      return list.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
    },
    [rangeMs],
  );

  useEffect(() => {
    if (transformerId == null) return;
    queueMicrotask(() => setLoading(true));
    const since = new Date(Date.now() - rangeMs).toISOString();
    fetchReadings(transformerId, since)
      .then((r) => setReadings([...r].reverse()))
      .catch((e) => console.error(`Failed to fetch ${title} data:`, e))
      .finally(() => setLoading(false));
  }, [transformerId, timeRange]);

  useEffect(() => {
    if (wsReading == null) return;
    queueMicrotask(() =>
      setReadings((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        if (seen.has(wsReading.id)) return prev;
        const merged = [...prev, wsReading].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        return trimToRange(merged);
      }),
    );
  }, [wsReading, trimToRange]);

  const chartData = useMemo(
    () =>
      readings.map((r) => {
        const raw = r[dataKey] as number | null | undefined;
        let value: number | null = null;
        if (isValidNum(raw)) {
          if (validRange) {
            value = raw >= validRange.min && raw <= validRange.max ? raw : null;
          } else {
            value = raw;
          }
        }
        return { time: r.timestamp, value };
      }),
    [readings, dataKey, validRange],
  );

  const hasData = chartData.some((d) => d.value != null);

  const label = unit ? `${title} (${unit})` : title;

  if (transformerId == null) return null;

  if (loading) {
    return (
      <Card
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={`Loading ${title} chart`}
        className="border-border/80 shadow-none"
      >
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[clamp(8rem,25vh,14rem)] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-base font-semibold">{label}</CardTitle>
          {connected && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
                aria-hidden
              />
              Live
            </span>
          )}
        </div>
        <div className="flex gap-0.5 rounded-md border border-border/80 p-0.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setTimeRange(r.value)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                timeRange === r.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[clamp(8rem,25vh,14rem)] flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <p>No {title.toLowerCase()} data for this period</p>
            <p className="mt-1 text-xs">
              Readings will appear as the ESP32 sends data
            </p>
          </div>
        ) : (
          <div className="h-[clamp(8rem,25vh,14rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={CHART_MARGIN}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatTime}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: color }}
                  stroke={color}
                  className="text-muted-foreground"
                  domain={yDomain ?? ["auto", "auto"]}
                />
                <Tooltip
                  labelFormatter={(value) =>
                    formatTooltipTime(String(value ?? ""))
                  }
                  formatter={(value) => [
                    unit ? `${value} ${unit}` : value,
                    title,
                  ]}
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={label}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
