import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Skeleton } from "./ui/Skeleton";
import { fetchReadings } from "../api/client";
import type { Reading } from "../types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildHeatmap(readings: Reading[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const count: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of readings) {
    const ap = r.apparent_power;
    if (ap == null || Number.isNaN(ap)) continue;
    const d = new Date(r.timestamp);
    const day = d.getDay();
    const hour = d.getHours();
    grid[day][hour] += ap / 1000;
    count[day][hour] += 1;
  }
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 24; j++) {
      if (count[i][j] > 0) grid[i][j] = grid[i][j] / count[i][j];
    }
  }
  return grid;
}

export function LoadHeatmap({ transformerId }: { transformerId: number | null }) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(false);

  const since = useMemo(
    () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    []
  );

  useEffect(() => {
    if (transformerId == null) return;
    setLoading(true);
    fetchReadings(transformerId, since)
      .then(setReadings)
      .catch((e) => console.error("LoadHeatmap:", e))
      .finally(() => setLoading(false));
  }, [transformerId, since]);

  const grid = useMemo(() => buildHeatmap(readings), [readings]);
  const maxVal = useMemo(() => {
    let m = 0;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 24; j++) if (grid[i][j] > m) m = grid[i][j];
    return m || 1;
  }, [grid]);

  if (transformerId == null) return null;

  if (loading) {
    return (
      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Load heatmap (7 days)</CardTitle>
        <p className="text-xs text-muted-foreground">Day × hour · color = avg load (kVA)</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-0">
            <div className="grid grid-cols-[auto_1fr] gap-0.5 text-[10px]">
              <div className="pr-1" />
              <div className="flex gap-px">
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="w-3 shrink-0 text-center text-muted-foreground">
                    {h}
                  </span>
                ))}
              </div>
              {DAYS.map((day, i) => (
                <div key={day} className="flex items-center gap-1">
                  <span className="w-7 shrink-0 text-muted-foreground">{day}</span>
                  <div className="flex gap-px">
                    {grid[i].map((v, j) => (
                      <div
                        key={j}
                        className="h-4 w-3 shrink-0 rounded-sm transition-colors"
                        style={{
                          backgroundColor: "var(--color-primary)",
                          opacity: maxVal > 0 ? 0.15 + 0.85 * (v / maxVal) : 0.15,
                        }}
                        title={`${day} ${j}:00 — ${v.toFixed(2)} kVA`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
              <span>Low</span>
              <div className="flex gap-px">
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                  <div
                    key={f}
                    className="h-2 w-4 rounded-sm"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      opacity: f * 0.85 + 0.15,
                    }}
                  />
                ))}
              </div>
              <span>High</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
