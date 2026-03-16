const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export async function fetchTransformers() {
  const res = await fetch(`${API_BASE}/transformers/`);
  if (!res.ok) throw new Error("Failed to fetch transformers");
  return res.json();
}

export async function fetchReadings(transformerId: number, since?: string) {
  const params = new URLSearchParams();
  params.set("transformer", String(transformerId));
  if (since) params.set("since", since);
  const res = await fetch(`${API_BASE}/readings/?${params}`);
  if (!res.ok) throw new Error("Failed to fetch readings");
  return res.json();
}

export async function fetchAlerts(transformerId?: number) {
  const params = transformerId ? `?transformer=${transformerId}` : "";
  const res = await fetch(`${API_BASE}/alerts/${params}`);
  if (!res.ok) throw new Error("Failed to fetch alerts");
  return res.json();
}

export interface TransformerInsightsResponse {
  current: {
    loading_percent: number | null;
    voltage_status: "normal" | "low" | "high" | null;
    capacity_remaining_kva: number | null;
    power_factor_status: "good" | "fair" | "poor" | null;
    rated_kva: number;
    nominal_voltage: number;
  } | null;
  peak_load_24h_kva: number | null;
  energy_24h_kwh: number | null;
}

export async function fetchTransformerInsights(
  transformerId: number
): Promise<TransformerInsightsResponse> {
  const res = await fetch(`${API_BASE}/transformers/${transformerId}/insights/`);
  if (!res.ok) throw new Error("Failed to fetch transformer insights");
  return res.json();
}

export async function acknowledgeAlert(id: number) {
  const res = await fetch(`${API_BASE}/alerts/${id}/acknowledge/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to acknowledge alert");
  return res.json();
}

export async function acknowledgeAllAlerts(transformerId: number) {
  const res = await fetch(`${API_BASE}/alerts/acknowledge_all/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transformer: transformerId }),
  });
  if (!res.ok) throw new Error("Failed to acknowledge all alerts");
  return res.json();
}
