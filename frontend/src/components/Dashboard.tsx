import { useEffect, useState } from "react";
import {
  fetchTransformers,
  fetchReadings,
  fetchAlerts,
} from "../api/client";
import { LiveMeters } from "./LiveMeters";
import { AlertsList } from "./AlertsList";
import { ReadingsChart } from "./ReadingsChart";
import { CRITICAL_CONDITIONS, ConditionBadge } from "./ConditionBadge";
import { useMonitorWebSocket } from "../hooks/useMonitorWebSocket";
import type { Transformer, Reading, Alert } from "../types";

export function Dashboard() {
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [latestReading, setLatestReading] = useState<Reading | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const { reading: wsReading, connected } = useMonitorWebSocket(selectedId);

  const displayReading = wsReading ?? latestReading;
  const selectedTransformer = transformers.find((t) => t.id === selectedId);
  const isAtRisk = displayReading && CRITICAL_CONDITIONS.includes(displayReading.condition);

  useEffect(() => {
    (async () => {
      try {
        const t = await fetchTransformers();
        setTransformers(t);
        if (t.length > 0 && selectedId == null) setSelectedId(t[0].id);
      } catch (e) {
        console.error("Failed to fetch transformers:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    (async () => {
      try {
        const [r, a] = await Promise.all([
          fetchReadings(selectedId),
          fetchAlerts(selectedId),
        ]);
        setLatestReading(r[0] ?? null);
        setAlerts(a);
      } catch (e) {
        console.error("Failed to fetch data:", e);
      }
    })();
  }, [selectedId]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Pole Transformer Monitor
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Real-time condition monitoring for distribution transformers
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                <label
                  htmlFor="transformer-select"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Transformer
                </label>
                <select
                  id="transformer-select"
                  value={selectedId ?? ""}
                  onChange={(e) =>
                    setSelectedId(Number(e.target.value) || null)
                  }
                  className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  <option value="">Select transformer...</option>
                  {transformers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.serial ? `(${t.serial})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {selectedTransformer && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {selectedTransformer.rated_kva} kVA
                    {selectedTransformer.nominal_voltage ? (
                      <> @ {selectedTransformer.nominal_voltage}V</>
                    ) : null}
                  </span>
                  {selectedTransformer.site && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{selectedTransformer.site}</span>
                    </>
                  )}
                </div>
              )}
              {connected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-400">
                  <span
                    className="h-2 w-2 rounded-full bg-green-500 animate-pulse-dot"
                    aria-hidden
                  />
                  Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-full bg-muted-foreground/50"
                    aria-hidden
                  />
                  Offline
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {isAtRisk && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
            >
              <path
                fillRule="evenodd"
                d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.401 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                clipRule="evenodd"
              />
            </svg>
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-red-800 dark:text-red-200">
              Transformer at risk — current condition:
              {displayReading?.condition && (
                <ConditionBadge condition={displayReading.condition} />
              )}
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LiveMeters
              reading={displayReading}
              loading={loading}
              transformer={selectedTransformer ?? null}
            />
          </div>
          <div className="flex flex-col">
            <AlertsList
              alerts={alerts}
              setAlerts={setAlerts}
              loading={loading}
              transformerId={selectedId}
            />
          </div>
        </div>

        <div className="mt-6">
          <ReadingsChart transformerId={selectedId} />
        </div>
      </main>
    </div>
  );
}
