import type { Alert, Reading, Transformer } from "../../types";
import { CRITICAL_CONDITIONS } from "../ConditionBadge.constants";
import { ConditionBadge } from "../ConditionBadge";
import { Badge } from "../ui/Badge";
import { formatRelativeTime } from "../../lib/utils";
import { getConditionSeverity } from "../../lib/energyStatus";

function headroomKva(
  reading: Reading | null,
  transformer: Transformer | null,
): number | null {
  if (!reading || !transformer) return null;
  if (reading.apparent_power == null || Number.isNaN(reading.apparent_power))
    return null;
  if (!transformer.rated_kva) return null;
  return (transformer.rated_kva * 1000 - reading.apparent_power) / 1000;
}

function headroomBadge(
  headroom: number | null,
): { text: string; variant: "normal" | "warning" | "critical" } | null {
  if (headroom == null || Number.isNaN(headroom)) return null;
  if (headroom < 0)
    return {
      text: `Overload (${headroom.toFixed(1)} kVA)`,
      variant: "critical",
    };
  if (headroom <= 1)
    return {
      text: `Low headroom (${headroom.toFixed(1)} kVA)`,
      variant: "warning",
    };
  return { text: `Headroom ${headroom.toFixed(1)} kVA`, variant: "normal" };
}

/** Threshold (ms) to consider a non-selected transformer "recently seen". */
const LAST_SEEN_STALE_MS = 60_000;

function lastSeenStatus(
  lastSeen: string | null | undefined,
): "recent" | "stale" | "unknown" {
  if (!lastSeen) return "unknown";
  const age = Date.now() - new Date(lastSeen).getTime();
  if (age < LAST_SEEN_STALE_MS) return "recent";
  return "stale";
}

export function DeviceStatusTable({
  transformers,
  selectedId,
  onSelect,
  reading,
  connected,
  alerts,
}: {
  transformers: Transformer[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  reading: Reading | null;
  connected: boolean;
  alerts: Alert[];
}) {
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;
  const criticalCount = alerts.filter((a) =>
    CRITICAL_CONDITIONS.includes(a.condition),
  ).length;
  const selectedSeverity = reading
    ? getConditionSeverity(reading.condition)
    : "normal";
  const hr = headroomKva(
    reading,
    transformers.find((t) => t.id === selectedId) ?? null,
  );

  const hrBadge = headroomBadge(hr);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Device status</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Quick view of active devices and current health.
          </div>
        </div>

        {selectedSeverity !== "normal" && reading ? (
          <div className="text-xs text-muted-foreground">
            Current: <ConditionBadge condition={reading.condition} />
          </div>
        ) : null}
      </div>

      {/* Mobile card view */}
      <div className="space-y-2 md:hidden">
        {transformers.map((t) => {
          const isSelected = selectedId === t.id;
          const live = isSelected && connected;
          const seen = !isSelected ? lastSeenStatus(t.last_seen) : null;
          const lastUpdated =
            isSelected && reading
              ? formatRelativeTime(reading.timestamp)
              : null;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              aria-label={`Select transformer ${t.name}`}
              className={[
                "w-full rounded-lg border text-left transition-colors",
                isSelected
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/60 bg-card hover:bg-muted/30",
              ].join(" ")}
            >
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {t.name}
                  </span>
                  <Badge
                    variant={
                      live
                        ? "normal"
                        : !isSelected && seen === "recent"
                          ? "normal"
                          : !isSelected && seen === "stale"
                            ? "warning"
                            : "default"
                    }
                  >
                    {live
                      ? "Live"
                      : isSelected
                        ? "Offline"
                        : seen === "recent"
                          ? "Online"
                          : seen === "stale"
                            ? "Stale"
                            : "—"}
                  </Badge>
                </div>

                {(t.serial || t.site) && (
                  <div className="text-xs text-muted-foreground">
                    {t.serial ? `Serial: ${t.serial}` : ""}
                    {t.serial && t.site ? " · " : ""}
                    {t.site ? `Site: ${t.site}` : ""}
                  </div>
                )}

                {isSelected && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-2">
                    {reading && (
                      <ConditionBadge condition={reading.condition} />
                    )}
                    {!t.is_active && <Badge variant="warning">Inactive</Badge>}
                    {criticalCount > 0 && (
                      <Badge variant="critical">{criticalCount} critical</Badge>
                    )}
                    {unacknowledgedCount > 0 && criticalCount === 0 && (
                      <Badge variant="warning">{unacknowledgedCount} new</Badge>
                    )}
                    {unacknowledgedCount === 0 && (
                      <span className="text-xs text-muted-foreground">
                        All clear
                      </span>
                    )}
                    {hrBadge && (
                      <Badge variant={hrBadge.variant}>{hrBadge.text}</Badge>
                    )}
                    {lastUpdated && (
                      <span className="text-xs text-muted-foreground">
                        Updated {lastUpdated}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border/80 bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Transformer</th>
              <th className="px-4 py-3 font-medium">Connection</th>
              <th className="px-4 py-3 font-medium">Health</th>
              <th className="px-4 py-3 font-medium">Alerts</th>
              <th className="px-4 py-3 font-medium">Headroom</th>
            </tr>
          </thead>
          <tbody>
            {transformers.map((t) => {
              const isSelected = selectedId === t.id;
              const live = isSelected && connected;
              const seen = !isSelected ? lastSeenStatus(t.last_seen) : null;
              const lastUpdated =
                isSelected && reading
                  ? formatRelativeTime(reading.timestamp)
                  : null;
              const alertsCell = isSelected ? (
                <div className="flex items-center gap-2">
                  {criticalCount > 0 && (
                    <Badge variant="critical">{criticalCount} critical</Badge>
                  )}
                  {unacknowledgedCount > 0 && criticalCount === 0 ? (
                    <Badge variant="warning">{unacknowledgedCount} new</Badge>
                  ) : null}
                  {unacknowledgedCount === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      All clear
                    </span>
                  ) : null}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              );

              return (
                <tr
                  key={t.id}
                  className={[
                    "border-t border-border/60 align-top transition-colors",
                    isSelected
                      ? "bg-primary/5"
                      : "bg-transparent hover:bg-muted/30",
                  ].join(" ")}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={[
                        "block w-full text-left",
                        isSelected ? "text-foreground" : "text-foreground",
                      ].join(" ")}
                      onClick={() => onSelect(t.id)}
                      aria-label={`Select transformer ${t.name}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{t.name}</span>
                        {!t.is_active ? (
                          <Badge variant="warning">Inactive</Badge>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t.serial ? `Serial: ${t.serial} · ` : ""}
                        {t.site ? `Site: ${t.site}` : ""}
                      </div>
                    </button>
                  </td>

                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <Badge
                        variant={
                          live
                            ? "normal"
                            : !isSelected && seen === "recent"
                              ? "normal"
                              : !isSelected && seen === "stale"
                                ? "warning"
                                : "default"
                        }
                      >
                        {live
                          ? "Live"
                          : isSelected
                            ? "Offline"
                            : seen === "recent"
                              ? "Online"
                              : seen === "stale"
                                ? "Stale"
                                : "—"}
                      </Badge>
                      {lastUpdated ? (
                        <div className="text-xs text-muted-foreground">
                          Updated {lastUpdated}
                        </div>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {isSelected && reading ? (
                      <div className="space-y-2">
                        <ConditionBadge condition={reading.condition} />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">{alertsCell}</td>

                  <td className="px-4 py-3">
                    {isSelected ? (
                      hrBadge ? (
                        <Badge variant={hrBadge.variant}>{hrBadge.text}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {transformers.length === 0 ? (
        <div className="rounded-lg border border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground">
          No transformers available.
        </div>
      ) : null}
    </div>
  );
}
