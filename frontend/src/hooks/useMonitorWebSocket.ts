import { useEffect, useRef, useState } from "react";
import type { Reading } from "../types";

const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

export function useMonitorWebSocket(transformerId: number | null) {
  const [reading, setReading] = useState<Reading | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (transformerId == null) return;

    const connect = () => {
      const url = `${WS_BASE}/ws/monitor/${transformerId}/`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        reconnectRef.current = window.setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "reading_update" && data.reading) {
            setReading(data.reading);
          }
        } catch {
          // ignore
        }
      };
    };

    connect();
    return () => {
      if (reconnectRef.current != null) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [transformerId]);

  return { reading, connected };
}
