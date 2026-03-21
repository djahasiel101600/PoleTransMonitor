import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { LoadingGauge } from "./LoadingGauge";
import type { Reading, Transformer } from "../types";
import type { TransformerInsightsResponse } from "../api/client";

function computeLoadingPercent(
  apparentPower: number | null,
  ratedKva: number,
): number | null {
  if (apparentPower == null || Number.isNaN(apparentPower) || !ratedKva)
    return null;
  const ratedVa = ratedKva * 1000;
  return (apparentPower / ratedVa) * 100;
}

function computeVoltageStatus(
  voltage: number | null,
  nominalVoltage: number,
): "normal" | "low" | "high" | null {
  if (voltage == null || Number.isNaN(voltage)) return null;
  const low = nominalVoltage * 0.93;
  const high = nominalVoltage * 1.07;
  if (voltage >= low && voltage <= high) return "normal";
  return voltage < low ? "low" : "high";
}

function computeCapacityRemainingKva(
  apparentPower: number | null,
  ratedKva: number,
): number | null {
  if (apparentPower == null || Number.isNaN(apparentPower) || !ratedKva)
    return null;
  return (ratedKva * 1000 - apparentPower) / 1000;
}

function computePowerFactorStatus(
  pf: number | null,
): "good" | "fair" | "poor" | null {
  if (pf == null || Number.isNaN(pf)) return null;
  if (pf >= 0.85) return "good";
  if (pf >= 0.7) return "fair";
  return "poor";
}

export function TransformerInsights({
  reading,
  transformer,
  loading,
  insights24h,
}: {
  reading: Reading | null;
  transformer: Transformer | null;
  loading?: boolean;
  insights24h?: TransformerInsightsResponse | null;
}) {
  if (loading) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const nominalV = transformer?.nominal_voltage ?? 220;
  const ratedKva = transformer?.rated_kva ?? 15;

  const loadingPercent = reading
    ? computeLoadingPercent(reading.apparent_power ?? null, ratedKva)
    : null;
  const voltageStatus = reading
    ? computeVoltageStatus(reading.voltage ?? null, nominalV)
    : null;
  const capacityRemainingKva = reading
    ? computeCapacityRemainingKva(reading.apparent_power ?? null, ratedKva)
    : null;
  const pfStatus = reading
    ? computePowerFactorStatus(reading.power_factor ?? null)
    : null;

  const hasAny =
    loadingPercent != null ||
    voltageStatus != null ||
    capacityRemainingKva != null ||
    pfStatus != null ||
    insights24h?.peak_load_24h_kva != null ||
    insights24h?.energy_24h_kwh != null;

  if (!reading && !insights24h?.current) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Select a transformer and wait for readings
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container border-border/80 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Status at a glance
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Loading, voltage and capacity for quick assessment
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasAny && (
          <>
            {/* Loading gauge + status pills row */}
            <div className="flex flex-col items-center gap-6 @lg:flex-row @lg:items-start">
              {loadingPercent != null && (
                <div className="@lg:flex-shrink-0">
                  <LoadingGauge
                    value={loadingPercent}
                    max={125}
                    label={`of ${ratedKva} kVA`}
                  />
                </div>
              )}
              <div className="flex w-full flex-1 flex-wrap gap-2 @lg:max-w-none">
                {voltageStatus != null && (
                  <div className="flex-1 basis-24 rounded-md border border-border/80 bg-muted/30 px-3 py-2">
                    <p className="text-xs uppercase text-muted-foreground">
                      Voltage
                    </p>
                    <p
                      className={`mt-0.5 text-sm font-semibold ${
                        voltageStatus === "normal"
                          ? "text-foreground"
                          : voltageStatus === "low"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {voltageStatus === "normal"
                        ? "Normal"
                        : voltageStatus === "low"
                          ? "Low"
                          : "High"}
                    </p>
                  </div>
                )}
                {capacityRemainingKva != null && (
                  <div className="flex-1 basis-24 rounded-md border border-border/80 bg-muted/30 px-3 py-2">
                    <p className="text-xs uppercase text-muted-foreground">
                      Headroom
                    </p>
                    <p
                      className={`mt-0.5 text-sm font-semibold tabular-nums ${
                        capacityRemainingKva >= 0
                          ? "text-foreground"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {capacityRemainingKva >= 0
                        ? `${capacityRemainingKva.toFixed(1)} kVA`
                        : "Overload"}
                    </p>
                  </div>
                )}
                {pfStatus != null && (
                  <div className="flex-1 basis-24 rounded-md border border-border/80 bg-muted/30 px-3 py-2">
                    <p className="whitespace-nowrap text-xs uppercase text-muted-foreground">
                      Power factor
                    </p>
                    <p
                      className={`mt-0.5 text-sm font-semibold ${
                        pfStatus === "good"
                          ? "text-foreground"
                          : pfStatus === "fair"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {pfStatus === "good"
                        ? "Good"
                        : pfStatus === "fair"
                          ? "Fair"
                          : "Poor"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 24h aggregates from API */}
            {(insights24h?.peak_load_24h_kva != null ||
              insights24h?.energy_24h_kwh != null) && (
              <div className="flex flex-wrap gap-4 border-t border-border/80 pt-3 text-sm">
                {insights24h.peak_load_24h_kva != null && (
                  <span className="text-muted-foreground">
                    Peak load (24h):{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {insights24h.peak_load_24h_kva} kVA
                    </span>
                  </span>
                )}
                {insights24h.energy_24h_kwh != null && (
                  <span className="text-muted-foreground">
                    Energy (24h):{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {insights24h.energy_24h_kwh} kWh
                    </span>
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
