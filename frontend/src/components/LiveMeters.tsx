import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { ConditionBadge } from "./ConditionBadge";
import { Skeleton } from "./ui/Skeleton";
import type { Reading } from "../types";

function Meter({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">
        {value != null ? `${value.toFixed(2)} ${unit}` : "--"}
      </p>
    </div>
  );
}

export function LiveMeters({
  reading,
  loading,
}: {
  reading: Reading | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!reading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No data yet. Connect an ESP32 or wait for readings.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Live Readings</CardTitle>
        <ConditionBadge condition={reading.condition} />
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Meter label="Voltage" value={reading.voltage} unit="V" />
        <Meter label="Current" value={reading.current} unit="A" />
        <Meter label="Apparent Power" value={reading.apparent_power} unit="VA" />
        <Meter label="Power Factor" value={reading.power_factor} unit="" />
        <Meter label="Frequency" value={reading.frequency} unit="Hz" />
        <Meter label="Oil Temperature" value={reading.oil_temp} unit="°C" />
      </CardContent>
    </Card>
  );
}
