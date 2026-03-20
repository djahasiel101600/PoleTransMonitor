import type { Alert, Reading, Transformer } from "../../types";
import type { TransformerInsightsResponse } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { LiveMeters } from "../LiveMeters";
import { TransformerInsights } from "../TransformerInsights";
import { ReadingsChart } from "../ReadingsChart";
import { LoadByHourChart } from "../LoadByHourChart";
import { LoadHeatmap } from "../LoadHeatmap";
import { ConditionDonut } from "../ConditionDonut";
import { SystemHealthCard } from "./SystemHealthCard";
import { DeviceStatusTable } from "./DeviceStatusTable";
import { Badge } from "../ui/Badge";
import { ConditionBadge } from "../ConditionBadge";
import { CRITICAL_CONDITIONS } from "../ConditionBadge.constants";

export function MonitoringView({
  transformers,
  selectedId,
  selectedTransformer,
  reading,
  connected,
  loading,
  insights24h,
  recentReadingsForSparkline,
  alerts,
  onSelectTransformer,
  error,
}: {
  transformers: Transformer[];
  selectedId: number | null;
  selectedTransformer: Transformer | null;
  reading: Reading | null;
  connected: boolean;
  loading: boolean;
  insights24h: TransformerInsightsResponse | null;
  recentReadingsForSparkline: Reading[];
  alerts: Alert[];
  onSelectTransformer: (id: number) => void;
  error: string | null;
}) {
  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {reading && CRITICAL_CONDITIONS.includes(reading.condition) ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="critical">At risk</Badge>
            <span className="font-medium">Critical condition detected.</span>
            <ConditionBadge condition={reading.condition} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Verify load demand and power quality. Consider scheduling maintenance if the issue persists.
          </div>
        </div>
      ) : null}

      <section aria-label="Overview" className="space-y-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Overview</div>
          <div className="text-xs text-muted-foreground">Quick health checks to spot abnormal conditions immediately.</div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <SystemHealthCard reading={reading} transformer={selectedTransformer} loading={loading} connected={connected} />
          <TransformerInsights reading={reading} transformer={selectedTransformer} loading={loading} insights24h={insights24h} />

          <div>
            {selectedId != null ? (
              <ConditionDonut transformerId={selectedId} transformer={selectedTransformer} />
            ) : (
              <Card className="border-border/80 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Condition (24h)</CardTitle>
                </CardHeader>
                <CardContent className="py-10 text-center">
                  <div className="text-sm font-medium text-muted-foreground">Select a transformer</div>
                  <div className="mt-1 text-xs text-muted-foreground">Condition breakdown will appear once data is available.</div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Real-time monitoring" className="space-y-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Real-time monitoring</div>
          <div className="text-xs text-muted-foreground">
            Live meters update from the websocket feed. Critical metrics are color-highlighted.
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LiveMeters reading={reading} loading={loading} transformer={selectedTransformer} recentReadings={recentReadingsForSparkline} />
          </div>
          <div className="lg:col-span-1">
            <DeviceStatusTable
              transformers={transformers}
              selectedId={selectedId}
              onSelect={onSelectTransformer}
              reading={reading}
              connected={connected}
              alerts={alerts}
            />
          </div>
        </div>
      </section>

      <section aria-label="Historical trends" className="space-y-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Historical trends</div>
          <div className="text-xs text-muted-foreground">View voltage/current trends, load patterns, and condition distribution over time.</div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ReadingsChart transformerId={selectedId} />
          <LoadByHourChart transformerId={selectedId} />
        </div>

        <LoadHeatmap transformerId={selectedId} />
      </section>
    </div>
  );
}

