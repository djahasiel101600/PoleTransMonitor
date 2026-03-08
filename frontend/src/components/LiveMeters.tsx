import type { ReactElement } from "react";
import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { ConditionBadge } from "./ConditionBadge";
import { Skeleton } from "./ui/Skeleton";
import { formatRelativeTime } from "../lib/utils";
import type { Reading, Transformer } from "../types";

type MeterStatus = "normal" | "warning" | "critical";

const VOLTAGE_RANGE = { min: 0, max: 500 };
const CURRENT_RANGE = { min: 0, max: 500 };
const POWER_RANGE = { min: 0, max: 100000 };
const POWER_FACTOR_RANGE = { min: 0, max: 1.01 };
const FREQUENCY_RANGE = { min: 45, max: 65 };
const OIL_TEMP_RANGE = { min: -50, max: 200 };

function formatMeterValue(
  value: number | null | undefined,
  opts?: { min?: number; max?: number; decimals?: number }
): string {
  if (value == null || Number.isNaN(value)) return "--";
  if (opts?.min != null && value < opts.min) return "--";
  if (opts?.max != null && value > opts.max) return "--";
  const decimals = opts?.decimals ?? 2;
  return `${value.toFixed(decimals)}`;
}

function computeMeterStatus(
  param: string,
  value: number | null,
  transformer: Transformer | null
): MeterStatus {
  if (value == null || Number.isNaN(value)) return "normal";

  switch (param) {
    case "oil_temp": {
      if (value < 50) return "normal";
      if (value <= 75) return "normal";
      if (value <= 90) return "warning";
      return "critical";
    }
    case "voltage": {
      const nominal = transformer?.nominal_voltage ?? 220;
      const low = nominal * 0.93;
      const high = nominal * 1.07;
      if (value >= low && value <= high) return "normal";
      return "critical";
    }
    case "current": {
      const rated = transformer?.rated_current ?? 100;
      const pct = (value / rated) * 100;
      if (pct <= 100) return "normal";
      if (pct <= 125) return "warning";
      return "critical";
    }
    case "apparent_power": {
      const ratedVA = transformer ? transformer.rated_kva * 1000 : 15000;
      const pct = (value / ratedVA) * 100;
      if (pct <= 100) return "normal";
      if (pct <= 125) return "warning";
      return "critical";
    }
    case "frequency": {
      const nominal = transformer?.nominal_freq ?? 50;
      const diff = Math.abs(value - nominal);
      if (diff <= 1) return "normal";
      if (diff <= 2) return "warning";
      return "critical";
    }
    case "power_factor": {
      if (value >= 0.85) return "normal";
      if (value >= 0.7) return "warning";
      return "critical";
    }
    default:
      return "normal";
  }
}

function MeterIcon({ name }: { name: string }) {
  const icons: Record<string, ReactElement> = {
    voltage: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    ),
    current: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    ),
    power: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
      </>
    ),
    pf: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" />
    ),
    frequency: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    ),
    temp: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18m0 0l-4-4m4 4l4-4M4 9l4 4 4-4 4 4" />
    ),
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5 text-muted-foreground">
      {icons[name]}
    </svg>
  );
}

const Meter = memo(function Meter({
  label,
  value,
  unit,
  validRange,
  decimals = 2,
  icon,
  status = "normal",
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  validRange?: { min?: number; max?: number };
  decimals?: number;
  icon?: string;
  status?: MeterStatus;
}) {
  const formatted = formatMeterValue(value, {
    ...validRange,
    decimals,
  });
  const hasValue = formatted !== "--";

  const statusStyles =
    status === "critical"
      ? "border-red-300 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/10"
      : status === "warning"
        ? "border-amber-300 bg-amber-50/30 dark:border-amber-800/50 dark:bg-amber-900/5"
        : "";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border bg-muted/30 p-4 transition-colors hover:bg-muted/50 ${statusStyles}`}
    >
      {icon && (
        <div className="rounded-md bg-primary/10 p-2">
          <MeterIcon name={icon} />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
          {status !== "normal" && hasValue && (
            <span
              className={`ml-1.5 rounded px-1 py-0.5 text-[10px] font-medium ${
                status === "critical"
                  ? "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200"
                  : "bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200"
              }`}
            >
              {status === "critical" ? "Out of range" : "Warning"}
            </span>
          )}
        </p>
        <p
          className={`text-xl font-semibold tabular-nums ${
            hasValue ? "text-foreground" : "text-muted-foreground"
          } ${status === "critical" && hasValue ? "text-red-700 dark:text-red-400" : ""} ${status === "warning" && hasValue ? "text-amber-700 dark:text-amber-400" : ""}`}
        >
          {hasValue ? `${formatted} ${unit}` : "--"}
        </p>
      </div>
    </div>
  );
});

export function LiveMeters({
  reading,
  loading,
  transformer = null,
}: {
  reading: Reading | null;
  loading?: boolean;
  transformer?: Transformer | null;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={`meter-skeleton-${i}`} className="h-20" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!reading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-10 w-10 text-muted-foreground"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">No data yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect an ESP32 or wait for readings to appear
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Live Readings</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Updated {formatRelativeTime(reading.timestamp)}
          </p>
        </div>
        <ConditionBadge condition={reading.condition} />
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Meter
          label="Voltage"
          value={reading.voltage}
          unit="V"
          validRange={VOLTAGE_RANGE}
          icon="voltage"
          status={computeMeterStatus("voltage", reading.voltage ?? null, transformer)}
        />
        <Meter
          label="Current"
          value={reading.current}
          unit="A"
          validRange={CURRENT_RANGE}
          icon="current"
          status={computeMeterStatus("current", reading.current ?? null, transformer)}
        />
        <Meter
          label="Apparent Power"
          value={reading.apparent_power}
          unit="VA"
          validRange={POWER_RANGE}
          decimals={0}
          icon="power"
          status={computeMeterStatus("apparent_power", reading.apparent_power ?? null, transformer)}
        />
        <Meter
          label="Power Factor"
          value={reading.power_factor}
          unit=""
          validRange={POWER_FACTOR_RANGE}
          icon="pf"
          status={computeMeterStatus("power_factor", reading.power_factor ?? null, transformer)}
        />
        <Meter
          label="Frequency"
          value={reading.frequency}
          unit="Hz"
          validRange={FREQUENCY_RANGE}
          icon="frequency"
          status={computeMeterStatus("frequency", reading.frequency ?? null, transformer)}
        />
        <Meter
          label="Oil Temperature"
          value={reading.oil_temp}
          unit="°C"
          validRange={OIL_TEMP_RANGE}
          icon="temp"
          status={computeMeterStatus("oil_temp", reading.oil_temp ?? null, transformer)}
        />
      </CardContent>
    </Card>
  );
}
