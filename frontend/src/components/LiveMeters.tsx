import type { ReactElement } from "react";
import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { ConditionBadge } from "./ConditionBadge";
import { Skeleton } from "./ui/Skeleton";
import { formatRelativeTime } from "../lib/utils";
import type { Reading, Transformer } from "../types";

import { computeMeterStatus, type MeterStatus } from "../lib/energyStatus";

const VOLTAGE_RANGE = { min: 0, max: 500 };
const CURRENT_RANGE = { min: 0, max: 500 };
const POWER_RANGE = { min: 0, max: 100000 };
const POWER_FACTOR_RANGE = { min: 0, max: 1.01 };
const FREQUENCY_RANGE = { min: 45, max: 65 };
const ENERGY_KWH_RANGE = { min: 0, max: 999999 };

function formatMeterValue(
  value: number | null | undefined,
  opts?: { min?: number; max?: number; decimals?: number },
): string {
  if (value == null || Number.isNaN(value)) return "--";
  if (opts?.min != null && value < opts.min) return "--";
  if (opts?.max != null && value > opts.max) return "--";
  const decimals = opts?.decimals ?? 2;
  return `${value.toFixed(decimals)}`;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 40;
  const h = 14;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="shrink-0 opacity-70" aria-hidden>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(" ")}
      />
    </svg>
  );
}

function MeterIcon({ name }: { name: string }) {
  const icons: Record<string, ReactElement> = {
    voltage: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    ),
    current: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    ),
    power: (
      <>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 12h16"
        />
      </>
    ),
    pf: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10"
      />
    ),
    frequency: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    ),
    energy: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
      />
    ),
  };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      className="h-5 w-5 text-muted-foreground"
    >
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
  sparklineValues,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
  validRange?: { min?: number; max?: number };
  decimals?: number;
  icon?: string;
  status?: MeterStatus;
  sparklineValues?: number[];
}) {
  const formatted = formatMeterValue(value, {
    ...validRange,
    decimals,
  });
  const hasValue = formatted !== "--";

  const statusStyles =
    status === "critical"
      ? "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20"
      : status === "warning"
        ? "border-amber-200 bg-amber-50/30 dark:border-amber-800/30 dark:bg-amber-950/10"
        : "border-border/80 bg-card";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${statusStyles}`}
    >
      {icon && (
        <span className="text-muted-foreground">
          <MeterIcon name={icon} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          {label}
          {status !== "normal" && hasValue && (
            <span
              className={`ml-1.5 text-[10px] ${
                status === "critical"
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {status === "critical" ? "· Out of range" : "· Warning"}
            </span>
          )}
        </p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <p
            className={`text-lg font-semibold tabular-nums ${
              hasValue ? "text-foreground" : "text-muted-foreground"
            } ${status === "critical" && hasValue ? "text-red-700 dark:text-red-400" : ""} ${status === "warning" && hasValue ? "text-amber-700 dark:text-amber-400" : ""}`}
          >
            {hasValue ? `${formatted} ${unit}` : "--"}
          </p>
          {sparklineValues && sparklineValues.length >= 2 && (
            <Sparkline values={sparklineValues} />
          )}
        </div>
      </div>
    </div>
  );
});

function getSparklineValues(readings: Reading[], key: keyof Reading): number[] {
  const sorted = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  return sorted
    .map((r) => r[key])
    .filter((v): v is number => v != null && !Number.isNaN(v));
}

export function LiveMeters({
  reading,
  loading,
  transformer = null,
  recentReadings = [],
}: {
  reading: Reading | null;
  loading?: boolean;
  transformer?: Transformer | null;
  recentReadings?: Reading[];
}) {
  if (loading) {
    return (
      <Card className="@container border-border/80 shadow-none">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="grid gap-3 @xs:grid-cols-2 @lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={`meter-skeleton-${i}`} className="h-16 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!reading) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardContent className="flex flex-col items-center justify-center py-14 text-center">
          <div className="mb-3 rounded-full bg-muted p-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-8 w-8 text-muted-foreground"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">No data</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Waiting for readings
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container border-border/80 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Readings</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatRelativeTime(reading.timestamp)}
          </p>
        </div>
        <ConditionBadge condition={reading.condition} />
      </CardHeader>
      <CardContent className="grid gap-3 @xs:grid-cols-2 @lg:grid-cols-3">
        <Meter
          label="Voltage"
          value={reading.voltage}
          unit="V"
          validRange={VOLTAGE_RANGE}
          icon="voltage"
          status={computeMeterStatus(
            "voltage",
            reading.voltage ?? null,
            transformer,
          )}
          sparklineValues={getSparklineValues(recentReadings, "voltage")}
        />
        <Meter
          label="Current"
          value={reading.current}
          unit="A"
          validRange={CURRENT_RANGE}
          icon="current"
          status={computeMeterStatus(
            "current",
            reading.current ?? null,
            transformer,
          )}
          sparklineValues={getSparklineValues(recentReadings, "current")}
        />
        <Meter
          label="Real Power"
          value={reading.real_power}
          unit="W"
          validRange={POWER_RANGE}
          decimals={0}
          icon="power"
          status="normal"
        />
        <Meter
          label="Apparent Power"
          value={reading.apparent_power}
          unit="VA"
          validRange={POWER_RANGE}
          decimals={0}
          icon="power"
          status={computeMeterStatus(
            "apparent_power",
            reading.apparent_power ?? null,
            transformer,
          )}
          sparklineValues={getSparklineValues(recentReadings, "apparent_power")}
        />
        <Meter
          label="Power Factor"
          value={reading.power_factor}
          unit=""
          validRange={POWER_FACTOR_RANGE}
          icon="pf"
          status={computeMeterStatus(
            "power_factor",
            reading.power_factor ?? null,
            transformer,
          )}
          sparklineValues={getSparklineValues(recentReadings, "power_factor")}
        />
        <Meter
          label="Frequency"
          value={reading.frequency}
          unit="Hz"
          validRange={FREQUENCY_RANGE}
          icon="frequency"
          status={computeMeterStatus(
            "frequency",
            reading.frequency ?? null,
            transformer,
          )}
          sparklineValues={getSparklineValues(recentReadings, "frequency")}
        />
        <Meter
          label="Energy (kWh)"
          value={reading.energy_kwh}
          unit="kWh"
          validRange={ENERGY_KWH_RANGE}
          decimals={4}
          icon="energy"
          status="normal"
        />
      </CardContent>
    </Card>
  );
}
