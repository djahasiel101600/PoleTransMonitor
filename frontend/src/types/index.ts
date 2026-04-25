export interface Transformer {
  id: number;
  name: string;
  serial: string | null;
  nominal_voltage: number;
  nominal_freq: number;
  rated_kva: number;
  rated_current: number;
  site: string | null;
  reading_interval_minutes: number;
  /** Whether the ESP32 device is allowed to send readings */
  is_active: boolean;
  /** Staff-only list of SMS recipients assigned to this transformer */
  sms_recipients?: Array<{
    id: number;
    owner_name: string;
    phone_number: string;
  }>;
  /** SIM / modem phone number (optional), e.g. +639171234567 */
  phone_number?: string | null;
  /** Present for staff only; used as X-Device-Key on the ESP32 */
  device_api_key?: string | null;
  /** Last time the device posted a reading (ISO string, set by backend) */
  last_seen?: string | null;
  /** When true, the device will open its WiFiManager config portal on the next sync */
  pending_open_portal?: boolean;
  created_at: string;
}

export interface SmsRecipient {
  id: number;
  owner_name: string;
  phone_number: string;
  created_at: string;
}

export interface FirmwareRelease {
  id: number;
  version: string;
  bin_file: string;
  uploaded_at: string;
  is_active: boolean;
}

export interface Reading {
  id: number;
  transformer: number;
  transformer_id?: number;
  timestamp: string;
  voltage: number | null;
  current: number | null;
  apparent_power: number | null;
  real_power: number | null;
  power_factor: number | null;
  frequency: number | null;
  energy_kwh: number | null;
  condition: Condition;
}

export type Condition =
  | "normal"
  | "heavy_peak_load"
  | "danger_zone"
  | "overload"
  | "severe_overload"
  | "heavy_load"
  | "abnormal"
  | "poor_power_quality"
  | "critical";

export interface Alert {
  id: number;
  transformer: number;
  transformer_name: string;
  timestamp: string;
  condition: Condition;
  message: string;
  sms_sent: boolean;
  acknowledged: boolean;
}

// ---------------------------------------------------------------------------
// Report filters & pagination
// ---------------------------------------------------------------------------

export interface ReadingFilters {
  transformer?: number;
  timestamp_gte?: string;
  timestamp_lte?: string;
  condition?: string;        // comma-separated
  voltage_gte?: number;
  voltage_lte?: number;
  current_gte?: number;
  current_lte?: number;
  power_factor_gte?: number;
  power_factor_lte?: number;
  page?: number;
  page_size?: number;
  ordering?: string;
}

export interface AlertFilters {
  transformer?: number;
  timestamp_gte?: string;
  timestamp_lte?: string;
  condition?: string;        // comma-separated
  acknowledged?: boolean;
  sms_sent?: boolean;
  page?: number;
  page_size?: number;
  ordering?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SmsSettings {
  alert_template: string;
  status_template: string;
}
