import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { ReportsFilters, type FilterValues } from "./ReportsFilters";
import { ReportsTable } from "./ReportsTable";
import { ReportsChart } from "./ReportsChart";
import {
  fetchFilteredReadings,
  fetchFilteredAlerts,
  downloadReadingsCsv,
  downloadAlertsCsv,
} from "../api/client";
import type {
  Reading,
  Alert,
  PaginatedResponse,
  ReadingFilters,
  AlertFilters,
} from "../types";

type DataTab = "readings" | "alerts";

function filtersToReadingParams(
  f: FilterValues,
  transformerId: number | null,
  page: number,
  pageSize: number,
): ReadingFilters {
  const p: ReadingFilters = {
    page,
    page_size: pageSize,
    ordering: "-timestamp",
  };
  if (transformerId) p.transformer = transformerId;
  if (f.startDate) p.timestamp_gte = new Date(f.startDate).toISOString();
  if (f.endDate) p.timestamp_lte = new Date(f.endDate).toISOString();
  if (f.conditions.length) p.condition = f.conditions.join(",");
  if (f.voltageMin) p.voltage_gte = Number(f.voltageMin);
  if (f.voltageMax) p.voltage_lte = Number(f.voltageMax);
  if (f.currentMin) p.current_gte = Number(f.currentMin);
  if (f.currentMax) p.current_lte = Number(f.currentMax);
  if (f.pfMin) p.power_factor_gte = Number(f.pfMin);
  if (f.pfMax) p.power_factor_lte = Number(f.pfMax);
  return p;
}

function filtersToAlertParams(
  f: FilterValues,
  transformerId: number | null,
  page: number,
  pageSize: number,
): AlertFilters {
  const p: AlertFilters = { page, page_size: pageSize, ordering: "-timestamp" };
  if (transformerId) p.transformer = transformerId;
  if (f.startDate) p.timestamp_gte = new Date(f.startDate).toISOString();
  if (f.endDate) p.timestamp_lte = new Date(f.endDate).toISOString();
  if (f.conditions.length) p.condition = f.conditions.join(",");
  return p;
}

export function ReportsView({
  transformerId,
}: {
  transformerId: number | null;
}) {
  const [filters, setFilters] = useState<FilterValues | null>(null);
  const [tab, setTab] = useState<DataTab>("readings");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [readingsPage, setReadingsPage] =
    useState<PaginatedResponse<Reading> | null>(null);
  const [alertsPage, setAlertsPage] = useState<PaginatedResponse<Alert> | null>(
    null,
  );

  const fetchData = useCallback(
    async (f: FilterValues, t: DataTab, p: number, ps: number) => {
      setLoading(true);
      try {
        if (t === "readings") {
          const params = filtersToReadingParams(f, transformerId, p, ps);
          const res = await fetchFilteredReadings(params);
          setReadingsPage(res);
        } else {
          const params = filtersToAlertParams(f, transformerId, p, ps);
          const res = await fetchFilteredAlerts(params);
          setAlertsPage(res);
        }
      } catch (err) {
        console.error("Failed to fetch report data:", err);
      } finally {
        setLoading(false);
      }
    },
    [transformerId],
  );

  const handleApply = useCallback(
    (f: FilterValues) => {
      setFilters(f);
      setPage(1);
      fetchData(f, tab, 1, pageSize);
    },
    [fetchData, tab, pageSize],
  );

  const handleTabChange = useCallback(
    (t: DataTab) => {
      setTab(t);
      setPage(1);
      if (filters) fetchData(filters, t, 1, pageSize);
    },
    [fetchData, filters, pageSize],
  );

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      if (filters) fetchData(filters, tab, p, pageSize);
    },
    [fetchData, filters, tab, pageSize],
  );

  const handlePageSizeChange = useCallback(
    (ps: number) => {
      setPageSize(ps);
      setPage(1);
      if (filters) fetchData(filters, tab, 1, ps);
    },
    [fetchData, filters, tab],
  );

  const handleExportReadings = async () => {
    if (!filters) return;
    setExporting(true);
    try {
      const params = filtersToReadingParams(
        filters,
        transformerId,
        1,
        pageSize,
      );
      await downloadReadingsCsv(params);
    } catch (err) {
      console.error("CSV export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportAlerts = async () => {
    if (!filters) return;
    setExporting(true);
    try {
      const params = filtersToAlertParams(filters, transformerId, 1, pageSize);
      await downloadAlertsCsv(params);
    } catch (err) {
      console.error("CSV export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="space-y-6"
      role="tabpanel"
      id="tabpanel-reports"
      aria-labelledby="tab-reports"
    >
      {/* Filters */}
      <Card className="border-border/60 shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4.5 w-4.5 text-primary"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Reports & Analysis
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Filter historical data, view trends, and export CSV reports
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ReportsFilters onApply={handleApply} loading={loading} />
        </CardContent>
      </Card>

      {/* Export toolbar */}
      {filters && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card p-3">
          <span className="mr-1 text-xs font-medium text-muted-foreground">
            Export:
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={handleExportReadings}
            className="h-7 text-xs"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1.5 h-3.5 w-3.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? "Exporting..." : "Download Readings CSV"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={handleExportAlerts}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1.5 h-3.5 w-3.5"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? "Exporting..." : "Download Alerts CSV"}
          </Button>
          {readingsPage && (
            <span className="text-xs text-muted-foreground">
              {readingsPage.count.toLocaleString()} readings found
            </span>
          )}
        </div>
      )}

      {/* Chart (readings only) */}
      {readingsPage && readingsPage.results.length > 0 && (
        <div className="animate-fade-in">
          <ReportsChart readings={readingsPage.results} />
        </div>
      )}

      {/* Data table */}
      {filters && (
        <Card className="border-border/60 shadow-none">
          <CardContent className="pt-4 sm:pt-5">
            <ReportsTable
              tab={tab}
              onTabChange={handleTabChange}
              readingsPage={readingsPage}
              alertsPage={alertsPage}
              loading={loading}
              page={page}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
