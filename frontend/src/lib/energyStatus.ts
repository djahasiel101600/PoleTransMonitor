import type { Condition, Transformer, Reading } from "../types";
import { CRITICAL_CONDITIONS } from "../components/ConditionBadge.constants";

export type MeterStatus = "normal" | "warning" | "critical";

const WARNING_CONDITIONS: Condition[] = [
  "heavy_peak_load",
  "overload",
  "heavy_load",
  "poor_power_quality",
];

export function getConditionSeverity(condition: Condition): MeterStatus {
  if (CRITICAL_CONDITIONS.includes(condition)) return "critical";
  if (WARNING_CONDITIONS.includes(condition)) return "warning";
  return "normal";
}

export function computeLoadingPercent(
  apparentPower: number | null,
  ratedKva: number
): number | null {
  if (apparentPower == null || Number.isNaN(apparentPower) || !ratedKva) return null;
  const ratedVa = ratedKva * 1000;
  return (apparentPower / ratedVa) * 100;
}

/**
 * Shared abnormality classification used across UI.
 * Keeps thresholds consistent between the overview card, meter cards and device status table.
 */
export function computeMeterStatus(
  param: "voltage" | "current" | "apparent_power" | "frequency" | "power_factor",
  value: number | null | undefined,
  transformer: Transformer | null
): MeterStatus {
  if (value == null || Number.isNaN(value)) return "normal";

  switch (param) {
    case "voltage": {
      const nominal = transformer?.nominal_voltage ?? 220;
      const low = nominal * 0.93;
      const high = nominal * 1.07;
      if (value >= low && value <= high) return "normal";
      return "critical";
    }
    case "current": {
      const rated = transformer?.rated_current ?? 100;
      const pct = (value / rated) * 100;
      if (pct <= 100) return "normal";
      if (pct <= 125) return "warning";
      return "critical";
    }
    case "apparent_power": {
      const ratedVA = transformer ? transformer.rated_kva * 1000 : 15000;
      const pct = (value / ratedVA) * 100;
      if (pct <= 100) return "normal";
      if (pct <= 125) return "warning";
      return "critical";
    }
    case "frequency": {
      const nominal = transformer?.nominal_freq ?? 50;
      const diff = Math.abs(value - nominal);
      if (diff <= 1) return "normal";
      if (diff <= 2) return "warning";
      return "critical";
    }
    case "power_factor": {
      if (value >= 0.85) return "normal";
      if (value >= 0.7) return "warning";
      return "critical";
    }
  }
}

export function getAbnormalMeters(
  reading: Reading | null,
  transformer: Transformer | null
): Array<{ key: "voltage" | "current" | "apparent_power" | "frequency" | "power_factor"; label: string; status: MeterStatus }> {
  if (!reading) return [];

  const items: Array<{
    key: "voltage" | "current" | "apparent_power" | "frequency" | "power_factor";
    label: string;
    status: MeterStatus;
  }> = [
    {
      key: "voltage",
      label: "Voltage",
      status: computeMeterStatus("voltage", reading.voltage, transformer),
    },
    {
      key: "current",
      label: "Current",
      status: computeMeterStatus("current", reading.current, transformer),
    },
    {
      key: "apparent_power",
      label: "Apparent Power",
      status: computeMeterStatus("apparent_power", reading.apparent_power, transformer),
    },
    {
      key: "power_factor",
      label: "Power Factor",
      status: computeMeterStatus("power_factor", reading.power_factor, transformer),
    },
    {
      key: "frequency",
      label: "Frequency",
      status: computeMeterStatus("frequency", reading.frequency, transformer),
    },
  ];

  return items.filter((i) => i.status !== "normal");
}

