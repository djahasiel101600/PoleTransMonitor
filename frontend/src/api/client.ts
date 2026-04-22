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
  reading_interval_minutes?: number;
  site?: string | null;
  phone_number?: string | null;
  is_active?: boolean;
  sms_recipients_ids?: number[];
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

export async function resetTransformer(transformerId: number) {
  const res = await authFetch(`${API_BASE}/transformers/${transformerId}/reset/`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to reset transformer");
  }
  return res.json() as Promise<{ ok: boolean; energy_kwh_offset: number }>;
}

export interface CreateContactPayload {
  owner_name: string;
  phone_number: string;
}

export async function fetchContacts() {
  const res = await authFetch(`${API_BASE}/contacts/`, {});
  if (!res.ok) throw new Error("Failed to fetch contacts");
  return res.json() as Promise<
    Array<{ id: number; owner_name: string; phone_number: string; created_at: string }>
  >;
}

export async function createContact(payload: CreateContactPayload) {
  const res = await authFetch(`${API_BASE}/contacts/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to create contact");
  }
  return res.json() as Promise<{
    id: number;
    owner_name: string;
    phone_number: string;
    created_at: string;
  }>;
}

export async function deleteContact(contactId: number) {
  const res = await authFetch(`${API_BASE}/contacts/${contactId}/`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to delete contact");
  }
  return true;
}

// ---------------------------------------------------------------------------
// Reports: filtered & paginated queries + CSV export
// ---------------------------------------------------------------------------

import type {
  Reading,
  Alert,
  ReadingFilters,
  AlertFilters,
  PaginatedResponse,
} from "../types";

function buildFilterParams(filters: ReadingFilters | AlertFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params;
}

export async function fetchFilteredReadings(
  filters: ReadingFilters,
): Promise<PaginatedResponse<Reading>> {
  const params = buildFilterParams(filters);
  const res = await authFetch(`${API_BASE}/readings/?${params}`, {});
  if (!res.ok) throw new Error("Failed to fetch filtered readings");
  return res.json();
}

export async function fetchFilteredAlerts(
  filters: AlertFilters,
): Promise<PaginatedResponse<Alert>> {
  const params = buildFilterParams(filters);
  const res = await authFetch(`${API_BASE}/alerts/?${params}`, {});
  if (!res.ok) throw new Error("Failed to fetch filtered alerts");
  return res.json();
}

export async function downloadReadingsCsv(filters: ReadingFilters): Promise<void> {
  const params = buildFilterParams(filters);
  // Remove pagination params for full export
  params.delete("page");
  params.delete("page_size");
  const res = await authFetch(`${API_BASE}/readings/export_csv/?${params}`, {});
  if (!res.ok) throw new Error("Failed to download readings CSV");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "readings_export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadAlertsCsv(filters: AlertFilters): Promise<void> {
  const params = buildFilterParams(filters);
  params.delete("page");
  params.delete("page_size");
  const res = await authFetch(`${API_BASE}/alerts/export_csv/?${params}`, {});
  if (!res.ok) throw new Error("Failed to download alerts CSV");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "alerts_export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// User registration & management
// ---------------------------------------------------------------------------

export interface RegisterResponse {
  detail: string;
  access?: string;
  refresh?: string;
}

export async function registerUser(
  username: string,
  password: string,
  password2: string,
): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE}/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, password2 }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg =
      data?.username?.[0] ??
      data?.password?.[0] ??
      data?.password2?.[0] ??
      data?.non_field_errors?.[0] ??
      data?.detail ??
      "Registration failed.";
    throw new Error(msg);
  }
  return data as RegisterResponse;
}

export interface AppUser {
  id: number;
  username: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_approved: boolean;
  date_joined: string;
}

export async function fetchUsers(): Promise<AppUser[]> {
  const res = await authFetch(`${API_BASE}/users/`, {});
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function approveUser(id: number): Promise<AppUser> {
  const res = await authFetch(`${API_BASE}/users/${id}/approve/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to approve user");
  return res.json();
}

export async function deleteUser(id: number): Promise<void> {
  const res = await authFetch(`${API_BASE}/users/${id}/`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to delete user");
  }
}
