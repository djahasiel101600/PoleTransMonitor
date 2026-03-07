import { useEffect, useState } from "react";
import {
  fetchTransformers,
  fetchReadings,
  fetchAlerts,
} from "../api/client";
import { LiveMeters } from "./LiveMeters";
import { AlertsList } from "./AlertsList";
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
    <div className="min-h-screen bg-background p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Pole Transformer Monitor</h1>
        <p className="text-sm text-muted-foreground">
          Real-time condition monitoring for distribution transformers
        </p>
      </header>

      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium">Transformer:</label>
        <select
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(Number(e.target.value) || null)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Select...</option>
          {transformers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.serial ?? t.id})
            </option>
          ))}
        </select>
        {connected && (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Live
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LiveMeters reading={displayReading} loading={loading} />
        </div>
        <div>
          <AlertsList
            alerts={alerts}
            loading={loading}
            onAcknowledge={() =>
              selectedId && fetchAlerts(selectedId).then(setAlerts)
            }
          />
        </div>
      </div>
    </div>
  );
}
