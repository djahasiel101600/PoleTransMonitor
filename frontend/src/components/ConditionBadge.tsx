import { memo } from "react";
import { Badge } from "./ui/Badge";
import type { Condition } from "../types";
import { CRITICAL_CONDITIONS } from "./ConditionBadge.constants";

const CONDITION_LABELS: Record<Condition, string> = {
  normal: "Normal",
  heavy_peak_load: "Heavy Peak Load",
  danger_zone: "Danger Zone",
  overload: "Overload",
  severe_overload: "Severe Overload",
  heavy_load: "Heavy Load",
  abnormal: "Abnormal",
  poor_power_quality: "Poor Power Quality",
  critical: "Critical",
};

const WARNING_CONDITIONS: Condition[] = [
  "heavy_peak_load",
  "overload",
  "heavy_load",
  "poor_power_quality",
];

export const ConditionBadge = memo(function ConditionBadge({ condition }: { condition: Condition }) {
  let variant: "normal" | "warning" | "critical" = "normal";
  if (CRITICAL_CONDITIONS.includes(condition)) variant = "critical";
  else if (WARNING_CONDITIONS.includes(condition)) variant = "warning";

  return (
    <Badge variant={variant}>{CONDITION_LABELS[condition] ?? condition}</Badge>
  );
});
