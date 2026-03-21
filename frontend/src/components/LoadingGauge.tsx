import { memo } from "react";

/** Semicircular gauge for loading % (0–100+). Status colors: normal / warning / critical. */
export const LoadingGauge = memo(function LoadingGauge({
  value,
  max = 125,
  label = "Loading",
  size = 120,
}: {
  value: number | null;
  max?: number;
  label?: string;
  size?: number;
}) {
  if (value == null || Number.isNaN(value)) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ width: size, height: size / 2 + 24 }}
      >
        <svg viewBox="0 0 120 84" className="w-full max-w-[120px]" aria-hidden>
          <path
            d="M 12 72 A 48 48 0 0 1 108 72"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted"
          />
        </svg>
        <span className="mt-1 text-lg font-semibold tabular-nums text-muted-foreground">
          --
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
    );
  }

  const percent = Math.min(value, max);
  const status =
    value <= 100 ? "normal" : value <= 125 ? "warning" : "critical";
  const strokeColor =
    status === "critical"
      ? "var(--color-critical)"
      : status === "warning"
        ? "var(--color-warning)"
        : "var(--color-primary)";

  const r = 48;
  const cx = 60;
  const cy = 72;
  const startAngle = 180;
  const endAngle = 180 - (percent / 100) * 180;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(startAngle));
  const y1 = cy - r * Math.sin(rad(startAngle));
  const x2 = cx + r * Math.cos(rad(endAngle));
  const y2 = cy - r * Math.sin(rad(endAngle));
  const largeArc = percent > 50 ? 1 : 0;
  const trackD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const valueD = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ width: size, height: size / 2 + 28 }}
      role="img"
      aria-label={`${label}: ${value.toFixed(1)}%`}
    >
      <svg viewBox="0 0 120 84" className="w-full max-w-[120px]" aria-hidden>
        <path
          d={trackD}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
        />
        <path
          d={valueD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span
        className={`mt-1 text-xl font-bold tabular-nums ${
          status === "critical"
            ? "text-red-600 dark:text-red-400"
            : status === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground"
        }`}
      >
        {value > 99.9 ? value.toFixed(0) : value.toFixed(1)}%
      </span>
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
});
