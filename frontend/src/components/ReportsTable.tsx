import { ConditionBadge } from "./ConditionBadge";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";
import type { Reading, Alert, PaginatedResponse } from "../types";

type DataTab = "readings" | "alerts";

export function ReportsTable({
  tab,
  onTabChange,
  readingsPage,
  alertsPage,
  loading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  tab: DataTab;
  onTabChange: (t: DataTab) => void;
  readingsPage: PaginatedResponse<Reading> | null;
  alertsPage: PaginatedResponse<Alert> | null;
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const data = tab === "readings" ? readingsPage : alertsPage;
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex items-center gap-4 border-b border-border/80 pb-2">
        <TabButton
          active={tab === "readings"}
          onClick={() => onTabChange("readings")}
        >
          Readings
        </TabButton>
        <TabButton
          active={tab === "alerts"}
          onClick={() => onTabChange("alerts")}
        >
          Alerts
        </TabButton>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded border border-border/80 bg-background px-2 py-1 text-xs outline-none"
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 rounded-full bg-muted p-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-6 w-6 text-muted-foreground"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">
              No results found
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              No {tab} match your current filters. Try adjusting your criteria.
            </p>
          </div>
        ) : tab === "readings" ? (
          <ReadingsTableContent readings={readingsPage!.results} />
        ) : (
          <AlertsTableContent alerts={alertsPage!.results} />
        )}
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Showing {startRow}–{endRow} of {totalCount.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="h-7 px-2 text-xs"
            >
              Prev
            </Button>
            <span className="px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="h-7 px-2 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "pb-1 text-sm font-medium transition-colors",
        active
          ? "border-b-2 border-primary text-foreground"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

const TH =
  "px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap bg-muted/30";
const TD = "px-3 py-2.5 text-sm whitespace-nowrap";

function ReadingsTableContent({ readings }: { readings: Reading[] }) {
  return (
    <table className="w-full min-w-[800px]">
      <thead>
        <tr className="border-b border-border/80">
          <th className={TH}>Time</th>
          <th className={TH}>Voltage (V)</th>
          <th className={TH}>Current (A)</th>
          <th className={TH}>Power (VA)</th>
          <th className={TH}>Real Power (W)</th>
          <th className={TH}>PF</th>
          <th className={TH}>Freq (Hz)</th>
          <th className={TH}>Energy (kWh)</th>
          <th className={TH}>Condition</th>
        </tr>
      </thead>
      <tbody>
        {readings.map((r) => (
          <tr
            key={r.id}
            className="border-b border-border/40 hover:bg-muted/30 transition-colors"
          >
            <td className={TD}>{fmtTime(r.timestamp)}</td>
            <td className={TD}>{fmtNum(r.voltage)}</td>
            <td className={TD}>{fmtNum(r.current)}</td>
            <td className={TD}>{fmtNum(r.apparent_power)}</td>
            <td className={TD}>{fmtNum(r.real_power)}</td>
            <td className={TD}>{fmtNum(r.power_factor, 3)}</td>
            <td className={TD}>{fmtNum(r.frequency)}</td>
            <td className={TD}>{fmtNum(r.energy_kwh, 4)}</td>
            <td className={TD}>
              <ConditionBadge condition={r.condition} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AlertsTableContent({ alerts }: { alerts: Alert[] }) {
  return (
    <table className="w-full min-w-[600px]">
      <thead>
        <tr className="border-b border-border/80">
          <th className={TH}>Time</th>
          <th className={TH}>Transformer</th>
          <th className={TH}>Condition</th>
          <th className={TH}>Message</th>
          <th className={TH}>SMS Sent</th>
          <th className={TH}>Acknowledged</th>
        </tr>
      </thead>
      <tbody>
        {alerts.map((a) => (
          <tr
            key={a.id}
            className="border-b border-border/40 hover:bg-muted/30 transition-colors"
          >
            <td className={TD}>{fmtTime(a.timestamp)}</td>
            <td className={TD}>{a.transformer_name}</td>
            <td className={TD}>
              <ConditionBadge condition={a.condition} />
            </td>
            <td className={TD + " max-w-[300px] truncate"}>{a.message}</td>
            <td className={TD}>{a.sms_sent ? "Yes" : "No"}</td>
            <td className={TD}>{a.acknowledged ? "Yes" : "No"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtNum(v: number | null | undefined, decimals = 2) {
  if (v == null) return "—";
  return Number(v).toFixed(decimals);
}
