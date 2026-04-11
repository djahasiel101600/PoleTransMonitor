import type { Alert, Reading, Transformer } from "../../types";
import type { TransformerInsightsResponse } from "../../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { LiveMeters } from "../LiveMeters";
import { TransformerInsights } from "../TransformerInsights";
import {
  VoltageChart,
  CurrentChart,
  ApparentPowerChart,
  RealPowerChart,
  PowerFactorChart,
  FrequencyChart,
  EnergyChart,
} from "../ReadingsChart";
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
    <div className="space-y-6 md:space-y-8">
      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {reading && CRITICAL_CONDITIONS.includes(reading.condition) ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="critical">At risk</Badge>
            <span className="font-medium">Critical condition detected.</span>
            <ConditionBadge condition={reading.condition} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Verify load demand and power quality. Consider scheduling
            maintenance if the issue persists.
          </div>
        </div>
      ) : null}

      {/* Overview Section */}
      <section aria-label="Overview" className="space-y-3 md:space-y-4">
        <div className="space-y-1">
          <div className="text-base md:text-lg font-semibold tracking-tight">
            Overview
          </div>
          <div className="text-xs md:text-sm text-muted-foreground">
            Quick health checks to spot abnormal conditions immediately.
          </div>
        </div>

        <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2 2xl:grid-cols-3">
          <SystemHealthCard
            reading={reading}
            transformer={selectedTransformer}
            loading={loading}
            connected={connected}
          />
          <TransformerInsights
            reading={reading}
            transformer={selectedTransformer}
            loading={loading}
            insights24h={insights24h}
          />

          <div>
            {selectedId != null ? (
              <ConditionDonut
                transformerId={selectedId}
                transformer={selectedTransformer}
              />
            ) : (
              <Card className="border-border/80 shadow-none h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Condition (24h)
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-8 md:py-12 text-center">
                  <div className="text-sm font-medium text-muted-foreground">
                    Select a transformer
                  </div>
                  <div className="mt-1 md:mt-2 text-xs text-muted-foreground">
                    Condition breakdown will appear once data is available.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* Real-time Monitoring Section */}
      <section
        aria-label="Real-time monitoring"
        className="space-y-3 md:space-y-4"
      >
        <div className="space-y-1">
          <div className="text-base md:text-lg font-semibold tracking-tight">
            Real-time monitoring
          </div>
          <div className="text-xs md:text-sm text-muted-foreground">
            Live meters update from the websocket feed. Critical metrics are
            color-highlighted.
          </div>
        </div>

        <div className="grid gap-4 md:gap-5 grid-cols-1 xl:grid-cols-2">
          <div className="xl:col-span-2 order-2 xl:order-1">
            <LiveMeters
              reading={reading}
              loading={loading}
              transformer={selectedTransformer}
              recentReadings={recentReadingsForSparkline}
            />
          </div>
          <div className="xl:col-span-2 order-1 xl:order-2">
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

      {/* Historical Trends Section */}
      <section
        aria-label="Historical trends"
        className="space-y-3 md:space-y-4"
      >
        <div className="space-y-1">
          <div className="text-base md:text-lg font-semibold tracking-tight">
            Historical trends
          </div>
          <div className="text-xs md:text-sm text-muted-foreground">
            View electrical parameter trends, load patterns, and condition
            distribution over time.
          </div>
        </div>

        <div className="grid gap-4 md:gap-5 grid-cols-1 lg:grid-cols-2">
          <VoltageChart transformerId={selectedId} />
          <CurrentChart transformerId={selectedId} />
          <ApparentPowerChart transformerId={selectedId} />
          <RealPowerChart transformerId={selectedId} />
          <PowerFactorChart transformerId={selectedId} />
          <FrequencyChart transformerId={selectedId} />
          <div className="lg:col-span-2">
            <EnergyChart transformerId={selectedId} />
          </div>
        </div>

        <div className="space-y-4 md:space-y-5">
          <LoadByHourChart transformerId={selectedId} />
        </div>

        <div className="pt-1 md:pt-2">
          <LoadHeatmap transformerId={selectedId} />
        </div>
      </section>
    </div>
  );
}
