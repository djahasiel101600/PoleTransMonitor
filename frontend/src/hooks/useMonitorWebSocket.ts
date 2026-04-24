import { useEffect, useRef, useState, useCallback } from "react";
import type { Reading } from "../types";

/** If no reading arrives within this window, mark the device as stale. */
const DEVICE_STALE_MS = 60_000; // 3× the 5s sample interval

export function useMonitorWebSocket(transformerId: number | null, accessToken?: string | null) {
  const [reading, setReading] = useState<Reading | null>(null);
  const [connected, setConnected] = useState(false);
  /** True when the WebSocket is open AND the device has sent a reading recently. */
  const [deviceOnline, setDeviceOnline] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(false);

  const resolveWsBase = useCallback(() => {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL as string;

    // Fallback to current page origin so deployed builds still connect
    // even when VITE_WS_URL was not configured.
    const isSecure = window.location.protocol === "https:";
    const protocol = isSecure ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
  }, []);

  const resolveAccessToken = useCallback(() => {
    // Prefer localStorage first because auth refresh updates it immediately.
    try {
      const latest = localStorage.getItem("accessToken");
      if (latest) return latest;
    } catch {
      // ignore and try prop fallback
    }
    return accessToken ?? null;
  }, [accessToken]);

  const resetStaleTimer = useCallback(() => {
    if (staleTimerRef.current != null) clearTimeout(staleTimerRef.current);
    setDeviceOnline(true);
    staleTimerRef.current = window.setTimeout(() => {
      setDeviceOnline(false);
    }, DEVICE_STALE_MS);
  }, []);

  useEffect(() => {
    if (transformerId == null) return;
    shouldReconnectRef.current = true;

    const connect = () => {
      const token = resolveAccessToken();

      // If there is no valid access token, don't attempt to connect.
      // This prevents endless WS reconnect loops after logout/expired auth.
      if (!token) {
        setConnected(false);
        setDeviceOnline(false);
        return;
      }

      if (reconnectRef.current != null) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }

      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }

      // Token is passed via querystring so Channels can authenticate the websocket.
      const wsBase = resolveWsBase();
      const url = token
        ? `${wsBase}/ws/monitor/${transformerId}/?token=${encodeURIComponent(token)}`
        : `${wsBase}/ws/monitor/${transformerId}/`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setDeviceOnline(false);
        if (staleTimerRef.current != null) clearTimeout(staleTimerRef.current);
        if (!shouldReconnectRef.current) return;
        reconnectRef.current = window.setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "reading_update" && data.reading) {
            setReading(data.reading);
            resetStaleTimer();
          }
        } catch {
          // ignore
        }
      };
    };

    connect();
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectRef.current != null) clearTimeout(reconnectRef.current);
      if (staleTimerRef.current != null) clearTimeout(staleTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      setDeviceOnline(false);
    };
  }, [transformerId, accessToken, resetStaleTimer, resolveAccessToken, resolveWsBase]);

  return { reading, connected, deviceOnline };
}
