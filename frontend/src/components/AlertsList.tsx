import { useState, useMemo, useCallback, useDeferredValue, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { ConditionBadge } from "./ConditionBadge";
import { Skeleton } from "./ui/Skeleton";
import { formatRelativeTime } from "../lib/utils";
import { acknowledgeAlert, acknowledgeAllAlerts } from "../api/client";
import type { Alert, Condition } from "../types";

const INITIAL_DISPLAY = 15;
const LOAD_MORE_STEP = 15;
const GROUP_THRESHOLD = 4;

type Filter = "all" | "unacknowledged";
type Density = "compact" | "detailed";

export function AlertsList({
  alerts,
  setAlerts,
  loading,
  transformerId,
}: {
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  loading?: boolean;
  transformerId: number | null;
}) {
  const [filter, setFilter] = useState<Filter>("unacknowledged");
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY);
  const [density, setDensity] = useState<Density>("compact");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [ackAllLoading, setAckAllLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAcknowledge = useCallback(
    async (id: number) => {
      setAlerts((a) =>
        a.map((alert) =>
          alert.id === id ? { ...alert, acknowledged: true } : alert,
        ),
      );
      try {
        await acknowledgeAlert(id);
        setActionError(null);
      } catch {
        setAlerts((a) =>
          a.map((alert) =>
            alert.id === id ? { ...alert, acknowledged: false } : alert,
          ),
        );
        setActionError("Failed to acknowledge alert. Please try again.");
      }
    },
    [setAlerts],
  );

  const handleAcknowledgeAll = useCallback(async () => {
    if (transformerId == null) return;
    const toRevert = alerts.filter((a) => !a.acknowledged).map((a) => a.id);
    setAlerts((a) => a.map((alert) => ({ ...alert, acknowledged: true })));
    setAckAllLoading(true);
    setActionError(null);
    try {
      await acknowledgeAllAlerts(transformerId);
      setActionError(null);
    } catch {
      setAlerts((a) =>
        a.map((alert) =>
          toRevert.includes(alert.id)
            ? { ...alert, acknowledged: false }
            : alert,
        ),
      );
      setActionError("Failed to acknowledge all alerts. Please try again.");
    } finally {
      setAckAllLoading(false);
    }
  }, [transformerId, alerts, setAlerts]);

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [alerts]);

  const deferredFilter = useDeferredValue(filter);
  const deferredDensity = useDeferredValue(density);

  const deferredFilteredAlerts = useMemo(() => {
    if (deferredFilter === "unacknowledged")
      return sortedAlerts.filter((a) => !a.acknowledged);
    return sortedAlerts;
  }, [sortedAlerts, deferredFilter]);

  const groupedByCondition = useMemo(() => {
    const groups: Record<string, Alert[]> = {};
    for (const a of deferredFilteredAlerts) {
      const key = a.condition;
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
  }, [deferredFilteredAlerts]);

  const displayedAlerts = useMemo(
    () => deferredFilteredAlerts.slice(0, displayCount),
    [deferredFilteredAlerts, displayCount],
  );

  const hasMore = displayedAlerts.length < deferredFilteredAlerts.length;
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;
  const acknowledgedCount = alerts.filter((a) => a.acknowledged).length;

  const criticalCount = alerts.filter((a) =>
    ["critical", "danger_zone", "severe_overload", "abnormal"].includes(
      a.condition,
    ),
  ).length;

  const handleLoadMore = useCallback(() => {
    setDisplayCount((c) =>
      Math.min(c + LOAD_MORE_STEP, deferredFilteredAlerts.length),
    );
  }, [deferredFilteredAlerts.length]);

  const handleShowAll = useCallback(() => {
    setDisplayCount(deferredFilteredAlerts.length);
  }, [deferredFilteredAlerts.length]);

  const handleFilterChange = useCallback((f: Filter) => {
    setFilter(f);
    setDisplayCount(INITIAL_DISPLAY);
  }, []);

  const toggleGroup = useCallback((condition: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(condition)) next.delete(condition);
      else next.add(condition);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <Skeleton className="h-5 w-20" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton
                key={`alert-skeleton-${i}`}
                className="h-14 w-full rounded-lg"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-fit max-h-[min(70vh,800px)] flex-col overflow-hidden border-border/80 shadow-none">
      <CardHeader className="flex-shrink-0 space-y-3 pb-2">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Alerts</CardTitle>
          {unacknowledgedCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {unacknowledgedCount}
            </span>
          )}
        </div>

        {alerts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {criticalCount > 0 && (
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {criticalCount} critical
                </span>
              )}
              {criticalCount > 0 && acknowledgedCount > 0 && " · "}
              {acknowledgedCount > 0 && (
                <span>{acknowledgedCount} acknowledged</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border border-border/80 p-0.5">
                <button
                  type="button"
                  onClick={() => handleFilterChange("all")}
                  className={`rounded px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    filter === "all"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange("unacknowledged")}
                  className={`rounded px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    filter === "unacknowledged"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  New
                </button>
              </div>
              <div className="flex rounded-md border border-border/80 p-0.5">
                <button
                  type="button"
                  onClick={() => setDensity("compact")}
                  className={`rounded px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    density === "compact"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setDensity("detailed")}
                  className={`rounded px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    density === "detailed"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  Detailed
                </button>
              </div>
              {unacknowledgedCount > 0 && transformerId != null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcknowledgeAll}
                  disabled={ackAllLoading}
                  className="text-xs"
                >
                  {ackAllLoading
                    ? "Acknowledging…"
                    : `Acknowledge all (${unacknowledgedCount})`}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col">
        {actionError && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {actionError}
          </div>
        )}
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 rounded-full bg-green-100 p-3 dark:bg-green-900/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-8 w-8 text-green-600 dark:text-green-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">All clear</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No alerts for this transformer
            </p>
          </div>
        ) : deferredFilteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 rounded-full bg-green-100 p-3 dark:bg-green-900/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-8 w-8 text-green-600 dark:text-green-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">
              No unacknowledged alerts
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              All {acknowledgedCount} alerts have been acknowledged
            </p>
          </div>
        ) : (
          <>
            <div className="max-h-[min(50vh,600px)] min-h-0 space-y-2 overflow-y-auto pr-1">
              {groupedByCondition.length >= GROUP_THRESHOLD
                ? groupedByCondition.map(([condition, groupAlerts]) => {
                    const isExpanded =
                      expandedGroups.has(condition) || groupAlerts.length <= 5;
                    const toShow = isExpanded
                      ? groupAlerts
                      : groupAlerts.slice(0, 2);
                    const hidden = groupAlerts.length - toShow.length;

                    return (
                      <div
                        key={condition}
                        className="rounded-lg border border-border/80 bg-muted/30"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            groupAlerts.length > 5 && toggleGroup(condition)
                          }
                          className="flex w-full items-center justify-between px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <div className="flex items-center gap-2">
                            <ConditionBadge
                              condition={condition as Condition}
                            />
                            <span className="text-xs text-muted-foreground">
                              {groupAlerts.length} alert
                              {groupAlerts.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {groupAlerts.length > 5 && (
                            <span className="text-xs text-muted-foreground">
                              {isExpanded
                                ? "▾ Collapse"
                                : `▸ Show ${hidden} more`}
                            </span>
                          )}
                        </button>
                        <div className="space-y-1 px-3 pb-2">
                          {toShow.map((alert) => (
                            <AlertCard
                              key={alert.id}
                              alert={alert}
                              compact={deferredDensity === "compact"}
                              onAcknowledge={handleAcknowledge}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                : displayedAlerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      compact={deferredDensity === "compact"}
                      onAcknowledge={handleAcknowledge}
                    />
                  ))}
            </div>

            {groupedByCondition.length < GROUP_THRESHOLD && hasMore && (
              <div className="mt-3 flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  Showing {displayedAlerts.length} of{" "}
                  {deferredFilteredAlerts.length} alerts
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    className="text-xs"
                  >
                    Load more
                  </Button>
                  {deferredFilteredAlerts.length - displayCount >
                    LOAD_MORE_STEP && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShowAll}
                      className="text-xs"
                    >
                      Show all
                    </Button>
                  )}
                </div>
              </div>
            )}

            {groupedByCondition.length < GROUP_THRESHOLD &&
              !hasMore &&
              deferredFilteredAlerts.length > INITIAL_DISPLAY && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Showing all {deferredFilteredAlerts.length} alerts
                </p>
              )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const AlertCard = memo(function AlertCard({
  alert,
  compact,
  onAcknowledge,
}: {
  alert: Alert;
  compact: boolean;
  onAcknowledge: (id: number) => void;
}) {
  return (
    <div
      className={`rounded-lg border ${
        alert.acknowledged
          ? "border-border bg-muted/20 opacity-75"
          : "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-900/10"
      } ${compact ? "p-2" : "p-3"}`}
    >
      <div
        className={`flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2 ${
          compact ? "gap-1" : "gap-2"
        }`}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <ConditionBadge condition={alert.condition} />
            {alert.acknowledged && (
              <span className="text-xs text-muted-foreground">
                Acknowledged
              </span>
            )}
            {alert.sms_sent && (
              <span
                className="text-xs text-muted-foreground"
                title="SMS notification sent to recipients"
              >
                SMS sent
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(alert.timestamp)}
            </span>
          </div>
          {!compact && (
            <p className="text-sm text-foreground line-clamp-2">
              {alert.message}
            </p>
          )}
        </div>
        {!alert.acknowledged && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAcknowledge(alert.id)}
            className="shrink-0 text-xs"
          >
            Acknowledge
          </Button>
        )}
      </div>
    </div>
  );
});
