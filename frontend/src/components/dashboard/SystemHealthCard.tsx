import type { Reading, Transformer } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { LoadingGauge } from "../LoadingGauge";
import { ConditionBadge } from "../ConditionBadge";
import { Skeleton } from "../ui/Skeleton";
import { formatRelativeTime } from "../../lib/utils";
import {
  computeLoadingPercent,
  getAbnormalMeters,
  getConditionSeverity,
  type MeterStatus,
} from "../../lib/energyStatus";

function meterBadgeVariant(
  status: MeterStatus,
): "normal" | "warning" | "critical" {
  if (status === "critical") return "critical";
  if (status === "warning") return "warning";
  return "normal";
}

export function SystemHealthCard({
  reading,
  transformer,
  loading,
  connected,
}: {
  reading: Reading | null;
  transformer: Transformer | null;
  loading: boolean;
  connected: boolean;
}) {
  if (loading) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-2 h-4 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <Skeleton className="h-32 w-28 rounded-md" />
            <div className="flex-1 space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-7 w-full rounded-md" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!reading) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            System health
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Awaiting live readings
          </p>
        </CardHeader>
        <CardContent className="py-10 text-center">
          <div className="text-sm font-medium text-muted-foreground">
            No data yet
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Select a transformer to start monitoring.
          </div>
        </CardContent>
      </Card>
    );
  }

  const severity = getConditionSeverity(reading.condition);
  const abnormalMeters = getAbnormalMeters(reading, transformer);
  const loadingPercent = computeLoadingPercent(
    reading.apparent_power,
    transformer?.rated_kva ?? 0,
  );

  const border =
    severity === "critical"
      ? "border-red-200 bg-red-50/20 dark:border-red-900/30 dark:bg-red-950/20"
      : severity === "warning"
        ? "border-amber-200 bg-amber-50/25 dark:border-amber-800/30 dark:bg-amber-950/15"
        : "border-border/80 bg-card";

  const severityLabel =
    severity === "critical"
      ? "Critical"
      : severity === "warning"
        ? "Warning"
        : "Normal";

  const badgeVariant = meterBadgeVariant(severity);

  return (
    <Card className={`shadow-none ${border}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">
              System health
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={badgeVariant}>{severityLabel}</Badge>
              <ConditionBadge condition={reading.condition} />
              <span className="text-xs text-muted-foreground">
                {connected ? "Live" : "Offline"}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Last update</div>
            <div className="text-sm font-medium tabular-nums">
              {formatRelativeTime(reading.timestamp)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {loadingPercent != null ? (
            <LoadingGauge
              value={loadingPercent}
              max={125}
              label={`of ${transformer?.rated_kva ?? "rated"} kVA`}
              size={120}
            />
          ) : (
            <div className="flex items-center justify-center rounded-md border border-border/80 bg-muted/30 px-4 py-6">
              <div className="text-sm text-muted-foreground">
                Loading data unavailable
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Abnormal readings
            </div>
            {abnormalMeters.length === 0 ? (
              <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                All monitored metrics within expected range.
              </div>
            ) : (
              <div className="space-y-2">
                {abnormalMeters
                  .slice()
                  .sort((a, b) =>
                    a.status === b.status
                      ? 0
                      : a.status === "critical"
                        ? -1
                        : 1,
                  )
                  .slice(0, 5)
                  .map((m) => (
                    <div
                      key={m.key}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-background/30 px-3 py-2"
                    >
                      <div className="text-sm font-medium">{m.label}</div>
                      <Badge variant={meterBadgeVariant(m.status)}>
                        {m.status === "critical"
                          ? "Critical"
                          : m.status === "warning"
                            ? "Warning"
                            : "Normal"}
                      </Badge>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {severity !== "normal" ? (
          <div className="rounded-lg border border-border/80 bg-background/30 px-3 py-2 text-sm text-muted-foreground">
            {severity === "critical"
              ? "Immediate attention recommended. Verify wiring, load demand, and power quality conditions."
              : "Monitor closely. Consider reducing load or investigating power quality causes."}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
