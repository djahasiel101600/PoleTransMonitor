export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

type AuthFailureHandler = () => void;
let authFailureHandler: AuthFailureHandler | null = null;

/** Called from AuthProvider so authFetch can log the user out when refresh fails. */
export function registerAuthFailureHandler(handler: AuthFailureHandler | null) {
  authFailureHandler = handler;
}

let refreshInFlight: Promise<string | null> | null = null;

function emitAccessToken(access: string) {
  window.dispatchEvent(new CustomEvent("poletrans:access-token", { detail: { access } }));
}

/**
 * Exchange refresh token for a new access token. Single-flight for concurrent 401s.
 * Persists access to localStorage and notifies listeners (AuthContext updates React state).
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    let refresh: string | null = null;
    try {
      refresh = localStorage.getItem("refreshToken");
    } catch {
      return null;
    }
    if (!refresh) return null;
    const res = await fetch(`${API_BASE}/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access?: string };
    if (!data.access) return null;
    try {
      localStorage.setItem("accessToken", data.access);
    } catch {
      // ignore
    }
    emitAccessToken(data.access);
    return data.access;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function getAccessToken(): string | null {
  try {
    return localStorage.getItem("accessToken");
  } catch {
    return null;
  }
}

function buildAuthInit(init?: RequestInit): RequestInit {
  const token = getAccessToken();
  const headers = new Headers(init?.headers ?? undefined);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

/**
 * Authenticated fetch: on 401, tries refresh once then retries the request.
 * Refresh token lifetime (1 day) caps how long this can succeed without re-login.
 */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  if (url.includes("/token/refresh/")) {
    return fetch(url, init);
  }
  let res = await fetch(url, buildAuthInit(init));
  if (res.status !== 401) return res;

  const newAccess = await refreshAccessToken();
  if (!newAccess) {
    authFailureHandler?.();
    return res;
  }

  res = await fetch(url, buildAuthInit(init));
  if (res.status === 401) {
    authFailureHandler?.();
  }
  return res;
}

export async function fetchTransformers() {
  const res = await authFetch(`${API_BASE}/transformers/`, {});
  if (!res.ok) throw new Error("Failed to fetch transformers");
  return res.json();
}

export async function fetchReadings(transformerId: number, since?: string) {
  const params = new URLSearchParams();
  params.set("transformer", String(transformerId));
  if (since) params.set("since", since);
  const res = await authFetch(`${API_BASE}/readings/?${params}`, {});
  if (!res.ok) throw new Error("Failed to fetch readings");
  return res.json();
}

export async function fetchAlerts(transformerId?: number) {
  const params = transformerId ? `?transformer=${transformerId}` : "";
  const res = await authFetch(`${API_BASE}/alerts/${params}`, {});
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
  const res = await authFetch(`${API_BASE}/transformers/${transformerId}/insights/`, {});
  if (!res.ok) throw new Error("Failed to fetch transformer insights");
  return res.json();
}

export async function acknowledgeAlert(id: number) {
  const res = await authFetch(`${API_BASE}/alerts/${id}/acknowledge/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to acknowledge alert");
  return res.json();
}

export async function acknowledgeAllAlerts(transformerId: number) {
  const res = await authFetch(`${API_BASE}/alerts/acknowledge_all/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transformer: transformerId }),
  });
  if (!res.ok) throw new Error("Failed to acknowledge all alerts");
  return res.json();
}

export type CreateTransformerPayload = {
  name: string;
  serial?: string | null;
  nominal_voltage?: number;
  nominal_freq?: number;
  rated_kva?: number;
  rated_current?: number;
  site?: string | null;
  phone_number?: string | null;
};

export async function createTransformer(payload: CreateTransformerPayload) {
  const res = await authFetch(`${API_BASE}/transformers/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to create transformer");
  }
  return res.json();
}

export async function updateTransformer(transformerId: number, payload: CreateTransformerPayload) {
  const res = await authFetch(`${API_BASE}/transformers/${transformerId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to update transformer");
  }
  return res.json();
}

export async function deleteTransformer(transformerId: number) {
  const res = await authFetch(`${API_BASE}/transformers/${transformerId}/`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to delete transformer");
  }
  return true;
}
