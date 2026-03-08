import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Skeleton } from "./ui/Skeleton";
import { fetchReadings } from "../api/client";
import { useMonitorWebSocket } from "../hooks/useMonitorWebSocket";
import type { Reading } from "../types";

type TimeRange = "1h" | "6h" | "24h";
type Metric = "voltage" | "current" | "oilTemp";

const TIME_RANGES: { value: TimeRange; label: string; ms: number }[] = [
  { value: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
  { value: "6h", label: "6 hours", ms: 6 * 60 * 60 * 1000 },
  { value: "24h", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
];

const METRIC_CONFIG: Record<Metric, { label: string; color: string; dataKey: string }> = {
  voltage: { label: "Voltage (V)", color: "#0369a1", dataKey: "voltage" },
  current: { label: "Current (A)", color: "#0d9488", dataKey: "current" },
  oilTemp: { label: "Oil temp (°C)", color: "#dc2626", dataKey: "oilTemp" },
};

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
  const d = new Date(t);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTooltipTime(t: string) {
  return new Date(t).toLocaleString();
}

export function ReadingsChart({ transformerId }: { transformerId: number | null }) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  const [visibleMetrics, setVisibleMetrics] = useState<Record<Metric, boolean>>({
    voltage: true,
    current: true,
    oilTemp: true,
  });
  const { reading: wsReading, connected } = useMonitorWebSocket(transformerId);

  const rangeMs = TIME_RANGES.find((r) => r.value === timeRange)!.ms;
  const trimToRange = useCallback(
    (list: Reading[]) => {
      const cutoff = Date.now() - rangeMs;
      return list.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
    },
    [rangeMs]
  );

  useEffect(() => {
    if (transformerId == null) return;
    setLoading(true);
    const since = new Date(Date.now() - rangeMs).toISOString();
    fetchReadings(transformerId, since)
      .then((r) => setReadings([...r].reverse()))
      .catch((e) => console.error("Failed to fetch chart data:", e))
      .finally(() => setLoading(false));
  }, [transformerId, timeRange]);

  useEffect(() => {
    if (wsReading == null) return;
    setReadings((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      if (seen.has(wsReading.id)) return prev;
      const merged = [...prev, wsReading].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      return trimToRange(merged);
    });
  }, [wsReading, trimToRange]);

  const chartData = useMemo(
    () =>
      readings.map((r) => ({
        time: r.timestamp,
        voltage: isValidNum(r.voltage) && r.voltage >= 0 && r.voltage <= 500 ? r.voltage : null,
        current: isValidNum(r.current) && r.current >= 0 && r.current <= 500 ? r.current : null,
        oilTemp: isValidNum(r.oil_temp) && r.oil_temp >= -50 && r.oil_temp <= 200 ? r.oil_temp : null,
        power: isValidNum(r.apparent_power) && r.apparent_power >= 0 ? r.apparent_power : null,
      })),
    [readings]
  );

  const showVoltage = visibleMetrics.voltage && chartData.some((d) => d.voltage != null);
  const showCurrent = visibleMetrics.current && chartData.some((d) => d.current != null);
  const showOilTemp = visibleMetrics.oilTemp && chartData.some((d) => d.oilTemp != null);

  const hasData = showVoltage || showCurrent || showOilTemp;

  const toggleMetric = useCallback((m: Metric) => {
    setVisibleMetrics((prev) => ({ ...prev, [m]: !prev[m] }));
  }, []);

  if (transformerId == null) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-lg">Trends</CardTitle>
          {connected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden />
              Live
            </span>
          )}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Metrics:</span>
            {(Object.keys(METRIC_CONFIG) as Metric[]).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={visibleMetrics[m]}
                  onChange={() => toggleMetric(m)}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                <span
                  style={{ color: visibleMetrics[m] ? METRIC_CONFIG[m].color : "var(--muted-foreground)" }}
                >
                  {METRIC_CONFIG[m].label.replace(/ \(\w+\)$/, "")}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setTimeRange(r.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
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
          <div className="flex h-64 flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <p>No historical data for this period</p>
            <p className="mt-1 text-xs">Readings will appear as the ESP32 sends data</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={formatTime}
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: showVoltage && !showOilTemp ? "#0369a1" : showOilTemp && !showVoltage ? "#dc2626" : "currentColor" }}
                    stroke={showVoltage && !showOilTemp ? "#0369a1" : showOilTemp && !showVoltage ? "#dc2626" : "currentColor"}
                    className="text-muted-foreground"
                    domain={["auto", "auto"]}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: showCurrent ? "#0d9488" : "currentColor" }}
                    stroke={showCurrent ? "#0d9488" : "currentColor"}
                    className="text-muted-foreground"
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    labelFormatter={(value) => formatTooltipTime(String(value ?? ""))}
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="voltage"
                    name="Voltage (V)"
                    stroke="#0369a1"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    hide={!showVoltage}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="current"
                    name="Current (A)"
                    stroke="#0d9488"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    hide={!showCurrent}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="oilTemp"
                    name="Oil temp (°C)"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    hide={!showOilTemp}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
