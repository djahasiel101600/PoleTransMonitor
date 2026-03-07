import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { ConditionBadge } from "./ConditionBadge";
import { Skeleton } from "./ui/Skeleton";
import { acknowledgeAlert } from "../api/client";
import type { Alert } from "../types";

export function AlertsList({
  alerts,
  loading,
  onAcknowledge,
}: {
  alerts: Alert[];
  loading?: boolean;
  onAcknowledge?: () => void;
}) {
  const handleAcknowledge = async (id: number) => {
    await acknowledgeAlert(id);
    onAcknowledge?.();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts.</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <ConditionBadge condition={alert.condition} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{alert.message}</p>
                </div>
                {!alert.acknowledged && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAcknowledge(alert.id)}
                  >
                    Acknowledge
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
