import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  fetchTransformers,
  fetchReadings,
  fetchAlerts,
  fetchTransformerInsights,
} from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { LiveMeters } from "./LiveMeters";
import { TransformerInsights } from "./TransformerInsights";
import { AlertsList } from "./AlertsList";
import { ReadingsChart } from "./ReadingsChart";
import { LoadByHourChart } from "./LoadByHourChart";
import { LoadHeatmap } from "./LoadHeatmap";
import { ConditionDonut } from "./ConditionDonut";
import { ConditionBadge } from "./ConditionBadge";
import { CRITICAL_CONDITIONS } from "./ConditionBadge.constants";
import { useMonitorWebSocket } from "../hooks/useMonitorWebSocket";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Button } from "./ui/Button";
import type { Transformer, Reading, Alert } from "../types";
import { LoginDialog } from "./LoginDialog";
import { AddTransformerDialog } from "./AddTransformerDialog";
import { EditTransformerDialog } from "./EditTransformerDialog";
import { DeleteTransformerDialog } from "./DeleteTransformerDialog";
import { TransformerManagementList } from "./TransformerManagementList";
import { ContactsScreen } from "./ContactsScreen";

export function Dashboard() {
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [latestReading, setLatestReading] = useState<Reading | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [insights24h, setInsights24h] = useState<Awaited<ReturnType<typeof fetchTransformerInsights>> | null>(null);
  const [recentReadingsForSparkline, setRecentReadingsForSparkline] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  const { accessToken, isAdmin, me, logout } = useAuth();
  const isAuthenticated = me != null;
  const isAuthenticating = !!accessToken && !isAuthenticated;

  const { reading: wsReading, connected } = useMonitorWebSocket(isAuthenticated ? selectedId : null, accessToken);

  const displayReading = wsReading ?? latestReading;
  const selectedTransformer = transformers.find((t) => t.id === selectedId);
  const isAtRisk = displayReading && CRITICAL_CONDITIONS.includes(displayReading.condition);
  const { theme, toggleTheme } = useTheme();
  const [showAddTransformer, setShowAddTransformer] = useState(false);
  const [transformerQuery, setTransformerQuery] = useState("");
  const [showTransformerManagement, setShowTransformerManagement] = useState(true);
  const [showContactsScreen, setShowContactsScreen] = useState(false);

  const [editTransformer, setEditTransformer] = useState<Transformer | null>(null);
  const [showEditTransformer, setShowEditTransformer] = useState(false);

  const [deleteTransformer, setDeleteTransformer] = useState<Transformer | null>(null);
  const [showDeleteTransformer, setShowDeleteTransformer] = useState(false);

  type TabKey = "monitoring" | "management";
  const [activeTab, setActiveTab] = useState<TabKey>("monitoring");
  const monitoringTabRef = useRef<HTMLButtonElement | null>(null);
  const managementTabRef = useRef<HTMLButtonElement | null>(null);

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") {
      return;
    }

    e.preventDefault();

    const go = (next: TabKey) => {
      setActiveTab(next);
      requestAnimationFrame(() => {
        if (next === "monitoring") monitoringTabRef.current?.focus();
        else managementTabRef.current?.focus();
      });
    };

    if (e.key === "Home") return go("monitoring");
    if (e.key === "End") return go(isAdmin ? "management" : "monitoring");

    // Only two tabs: Left/Right swap.
    if (activeTab === "monitoring") {
      if (e.key === "ArrowRight" && isAdmin) return go("management");
      return go("monitoring");
    }

    // activeTab === "management"
    if (e.key === "ArrowLeft") return go("monitoring");
    return go(isAdmin ? "management" : "monitoring");
  };

  useEffect(() => {
    // Non-admin users cannot access management.
    if (!isAdmin && activeTab === "management") setActiveTab("monitoring");
  }, [isAdmin, activeTab]);

  const refreshTransformers = async (preferredId?: number) => {
    const t = (await fetchTransformers()) as Transformer[];
    setTransformers(t);
    if (typeof preferredId === "number") {
      const next =
        t.find((x) => x.id === preferredId)?.id ?? (t.length ? t[0].id : null);
      setSelectedId(next);
    } else {
      setSelectedId((prev) => {
        if (prev != null && t.some((x) => x.id === prev)) return prev;
        return t.length ? t[0].id : null;
      });
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    void (async () => {
      try {
        await refreshTransformers();
      } catch (e) {
        console.error("Failed to fetch transformers:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (selectedId == null) return;
    setInsights24h(null);
    setRecentReadingsForSparkline([]);
    const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    (async () => {
      try {
        const [r, a, insights, recent] = await Promise.all([
          fetchReadings(selectedId),
          fetchAlerts(selectedId),
          fetchTransformerInsights(selectedId),
          fetchReadings(selectedId, since1h),
        ]);
        setLatestReading(r[0] ?? null);
        setAlerts(a);
        setInsights24h(insights);
        setRecentReadingsForSparkline(recent);
      } catch (e) {
        console.error("Failed to fetch data:", e);
      }
    })();
  }, [selectedId]);

  if (!accessToken) {
    // Show only the login UI until the user authenticates.
    return <LoginDialog open={true} onClose={() => {}} />;
  }

  if (isAuthenticating) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="mx-auto max-w-md pt-24 text-center text-sm text-muted-foreground"
        >
          Authenticating...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">
                Energy Monitor
              </h1>
              <select
                aria-label="Select transformer"
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(Number(e.target.value) || null)}
                className="rounded-md border border-border bg-transparent px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-0"
              >
                <option value="">Select…</option>
                {transformers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.serial ? ` · ${t.serial}` : ""}
                    {t.phone_number ? ` · ${t.phone_number}` : ""}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant={isAdmin ? "default" : "outline"}
                disabled={!isAdmin}
                onClick={() => {
                  setActiveTab("management");
                  setShowAddTransformer(true);
                }}
                className="h-9"
              >
                {isAdmin ? "Add Transformer" : "Add Transformer (admin)"}
              </Button>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-0"
              >
                {theme === "dark" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                )}
              </button>
              {selectedTransformer && (
                <span>
                  {selectedTransformer.rated_kva} kVA
                  {selectedTransformer.nominal_voltage ? ` @ ${selectedTransformer.nominal_voltage}V` : ""}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={logout}
                className="h-9"
              >
                Logout
              </Button>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  connected
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    connected ? "bg-primary animate-pulse-dot" : "bg-current opacity-50"
                  }`}
                  aria-hidden
                />
                {connected ? "Live" : "Offline"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1 space-y-8">
          <div className="sticky top-[4.5rem] z-10 -mx-4 border-b border-border/50 bg-background/95 px-4 py-2 backdrop-blur">
            <div className="flex gap-2" role="tablist" aria-label="Dashboard sections">
              <button
                type="button"
                role="tab"
                id="tab-monitoring"
                aria-controls="tabpanel-monitoring"
                ref={monitoringTabRef}
                aria-selected={activeTab === "monitoring"}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  activeTab === "monitoring"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50"
                }`}
                onClick={() => setActiveTab("monitoring")}
                onKeyDown={onTabKeyDown}
              >
                Monitoring
              </button>
              <button
                type="button"
                role="tab"
                id="tab-management"
                aria-controls="tabpanel-management"
                ref={managementTabRef}
                aria-selected={activeTab === "management"}
                disabled={!isAdmin}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  !isAdmin
                    ? "cursor-not-allowed border-border/80 bg-muted/30 text-muted-foreground opacity-60"
                    : activeTab === "management"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50"
                }`}
                onClick={() => {
                  if (!isAdmin) return;
                  setActiveTab("management");
                }}
                onKeyDown={onTabKeyDown}
              >
                Transformer Management
              </button>
            </div>
          </div>

          {activeTab === "monitoring" ? (
            <div role="tabpanel" id="tabpanel-monitoring" aria-labelledby="tab-monitoring">
              <TransformerInsights
                reading={displayReading}
                transformer={selectedTransformer ?? null}
                loading={loading}
                insights24h={insights24h}
              />

              {isAtRisk && (
                <div
                  role="alert"
                  className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4 shrink-0 text-destructive"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.401 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-destructive">
                    At risk —
                    {displayReading?.condition && (
                      <ConditionBadge condition={displayReading.condition} />
                    )}
                  </div>
                </div>
              )}

              <LiveMeters
                reading={displayReading}
                loading={loading}
                transformer={selectedTransformer ?? null}
                recentReadings={recentReadingsForSparkline}
              />

              <ReadingsChart transformerId={selectedId} />

              <div className="grid gap-8 lg:grid-cols-2">
                <LoadByHourChart transformerId={selectedId} />
                <ConditionDonut transformerId={selectedId} transformer={selectedTransformer ?? null} />
              </div>

              <LoadHeatmap transformerId={selectedId} />
            </div>
          ) : (
            <div role="tabpanel" id="tabpanel-management" aria-labelledby="tab-management">
              {isAdmin && showTransformerManagement && (
                <Card className="border-border/80 shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <CardTitle className="text-base font-semibold">Transformer Management</CardTitle>
                      <div className="text-xs text-muted-foreground">CRUD operations (admin only)</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowContactsScreen(true);
                          setShowTransformerManagement(false);
                        }}
                      >
                        Contacts
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTransformerManagement(false)}
                      >
                      Collapse
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <input
                          className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                          value={transformerQuery}
                          onChange={(e) => setTransformerQuery(e.target.value)}
                          placeholder="Search by name, serial, phone, or site..."
                          aria-label="Search transformers"
                        />
                        <Button type="button" size="sm" onClick={() => setShowAddTransformer(true)}>
                          Add
                        </Button>
                      </div>

                      <TransformerManagementList
                        transformers={transformers}
                        selectedId={selectedId}
                        query={transformerQuery}
                        onSelect={(id) => setSelectedId(id)}
                        onEdit={(t) => {
                          setEditTransformer(t);
                          setShowEditTransformer(true);
                        }}
                        onDelete={(t) => {
                          setDeleteTransformer(t);
                          setShowDeleteTransformer(true);
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {isAdmin && showContactsScreen && (
                <div>
                  <ContactsScreen />
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowContactsScreen(false);
                        setShowTransformerManagement(true);
                      }}
                    >
                      Back to Transformer Management
                    </Button>
                  </div>
                </div>
              )}

              {isAdmin && !showTransformerManagement && (
                <div className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowTransformerManagement(true)}>
                    Manage Transformers
                  </Button>
                </div>
              )}

              {!isAdmin && (
                <div className="text-sm text-muted-foreground">
                  Transformer Management is locked. Ask an admin to enable access.
                </div>
              )}
            </div>
          )}
        </div>

        <aside
          className="hidden w-full shrink-0 lg:block lg:w-80 xl:w-96"
          aria-label="Alerts"
        >
          <div className="sticky top-[4.5rem] max-h-[calc(100vh-5rem)] overflow-y-auto">
            <AlertsList
              alerts={alerts}
              setAlerts={setAlerts}
              loading={loading}
              transformerId={selectedId}
            />
          </div>
        </aside>
      </main>

      <div className="border-t border-border/80 px-4 py-4 lg:hidden">
        <AlertsList
          alerts={alerts}
          setAlerts={setAlerts}
          loading={loading}
          transformerId={selectedId}
        />
      </div>

      {isAdmin && (
        <AddTransformerDialog
          open={showAddTransformer}
          onClose={() => setShowAddTransformer(false)}
          onCreated={(t) => {
            void refreshTransformers(t.id);
          }}
        />
      )}

      {isAdmin && (
        <EditTransformerDialog
          open={showEditTransformer}
          onClose={() => {
            setShowEditTransformer(false);
            setEditTransformer(null);
          }}
          transformer={editTransformer}
          onUpdated={(t) => {
            void refreshTransformers(t.id);
          }}
        />
      )}

      {isAdmin && (
        <DeleteTransformerDialog
          open={showDeleteTransformer}
          onClose={() => {
            setShowDeleteTransformer(false);
            setDeleteTransformer(null);
          }}
          transformer={deleteTransformer}
          onDeleted={() => {
            void refreshTransformers();
          }}
        />
      )}
    </div>
  );
}

