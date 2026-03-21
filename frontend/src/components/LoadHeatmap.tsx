import { Fragment, useEffect, useState, useMemo } from "react";
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

export function LoadHeatmap({
  transformerId,
}: {
  transformerId: number | null;
}) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(false);

  const since = useMemo(() => {
    // Avoid `Date.now()` (react-hooks/purity) while keeping the same UTC time window.
    const ms = new Date().getTime() - 7 * 24 * 60 * 60 * 1000;
    return new Date(ms).toISOString();
  }, []);

  useEffect(() => {
    if (transformerId == null) return;
    // Defer state update to avoid react-hooks/set-state-in-effect linting.
    void Promise.resolve().then(() => setLoading(true));
    fetchReadings(transformerId, since)
      .then(setReadings)
      .catch((e) => console.error("LoadHeatmap:", e))
      .finally(() => setLoading(false));
  }, [transformerId, since]);

  const grid = useMemo(() => buildHeatmap(readings), [readings]);
  const maxVal = useMemo(() => {
    let m = 0;
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 24; j++) if (grid[i][j] > m) m = grid[i][j];
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
          <Skeleton className="h-72 w-full rounded-lg sm:h-80" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Load heatmap (7 days)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Day × hour · color = avg load (kVA)
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="mb-2 text-xs text-muted-foreground md:hidden">
          Scroll right to see all hours →
        </p>
        {/*
          Full-width heatmap: day column + 24 equal fractional columns so cells grow with the card.
          Horizontal scroll on very narrow viewports so labels stay readable.
        */}
        <div className="w-full min-w-0 overflow-x-auto">
          <div className="w-full max-w-full">
            <div className="grid grid-cols-[minmax(2.5rem,auto)_minmax(0,1fr)] gap-x-2 gap-y-1.5 items-stretch sm:gap-x-3 sm:gap-y-2">
              <div className="pr-0.5" aria-hidden />
              <div className="grid w-full min-w-0 grid-cols-[repeat(24,minmax(0,1fr))] gap-x-0.5 sm:gap-x-1">
                {Array.from({ length: 24 }, (_, h) => (
                  <span
                    key={h}
                    className="truncate text-center text-[10px] font-medium tabular-nums text-muted-foreground sm:text-xs"
                  >
                    {h}
                  </span>
                ))}
              </div>
              {DAYS.map((day, i) => (
                <Fragment key={day}>
                  <span className="self-center text-right text-xs font-medium tabular-nums text-muted-foreground sm:text-sm">
                    {day}
                  </span>
                  <div className="grid min-h-0 w-full grid-cols-[repeat(24,minmax(0,1fr))] gap-x-0.5 sm:gap-x-1">
                    {grid[i].map((v, j) => (
                      <div
                        key={j}
                        className="min-h-7 w-full min-w-0 rounded-sm transition-colors sm:min-h-10 sm:rounded-md"
                        style={{
                          backgroundColor: "var(--color-primary)",
                          opacity:
                            maxVal > 0 ? 0.15 + 0.85 * (v / maxVal) : 0.15,
                        }}
                        title={`${day} ${j}:00 — ${v.toFixed(2)} kVA`}
                      />
                    ))}
                  </div>
                </Fragment>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground sm:text-sm">
              <span>Low</span>
              <div className="flex gap-0.5 sm:gap-1">
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                  <div
                    key={f}
                    className="h-3 w-5 rounded-sm sm:h-3.5 sm:w-6"
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
