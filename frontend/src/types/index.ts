export interface Transformer {
  id: number;
  name: string;
  serial: string | null;
  nominal_voltage: number;
  nominal_freq: number;
  rated_kva: number;
  rated_current: number;
  site: string | null;
  created_at: string;
}

export interface Reading {
  id: number;
  transformer: number;
  transformer_id?: number;
  timestamp: string;
  voltage: number | null;
  current: number | null;
  apparent_power: number | null;
  power_factor: number | null;
  frequency: number | null;
  oil_temp: number | null;
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
