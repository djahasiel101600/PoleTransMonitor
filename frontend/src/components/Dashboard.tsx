import { useEffect, useState } from "react";
import {
  fetchTransformers,
  fetchReadings,
  fetchAlerts,
  fetchTransformerInsights,
} from "../api/client";
import { AlertsList } from "./AlertsList";
import { useMonitorWebSocket } from "../hooks/useMonitorWebSocket";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Button } from "./ui/Button";
import type { Transformer, Reading, Alert } from "../types";
import { LoginDialog } from "./LoginDialog";
import { AddTransformerDialog } from "./AddTransformerDialog";
import { EditTransformerDialog } from "./EditTransformerDialog";
import { DeleteTransformerDialog } from "./DeleteTransformerDialog";
import { ResetTransformerDialog } from "./ResetTransformerDialog";
import { TransformerManagementList } from "./TransformerManagementList";
import { ContactsScreen } from "./ContactsScreen";
import { Sidebar, type NavKey } from "./layout/Sidebar";
import { TopBar } from "./layout/TopBar";
import { PageHeader } from "./layout/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
} from "./ui/Dialog";
import { Toaster } from "./ui/Toaster";
import { MonitoringView } from "./dashboard/MonitoringView";
import { ReportsView } from "./ReportsView";
import { RegisterDialog } from "./RegisterDialog";
import { UserManagementScreen } from "./UserManagementScreen";
import { FirmwarePanel } from "./FirmwarePanel";
import { SmsTemplatePanel } from "./SmsTemplatePanel";
import { useToast } from "../hooks/useToast";

export function Dashboard() {
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [latestReading, setLatestReading] = useState<Reading | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [insights24h, setInsights24h] = useState<Awaited<
    ReturnType<typeof fetchTransformerInsights>
  > | null>(null);
  const [recentReadingsForSparkline, setRecentReadingsForSparkline] = useState<
    Reading[]
  >([]);
  const [transformersLoading, setTransformersLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { accessToken, isAdmin, me, logout } = useAuth();
  const isAuthenticated = me != null;
  const isAuthenticating = !!accessToken && !isAuthenticated;

  const { reading: wsReading, deviceOnline } = useMonitorWebSocket(
    isAuthenticated ? selectedId : null,
    accessToken,
  );

  const displayReading = wsReading ?? latestReading;
  const selectedTransformer = transformers.find((t) => t.id === selectedId);
  const { theme, toggleTheme } = useTheme();
  const uiLoading = transformersLoading || dataLoading;
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;
  const [showAddTransformer, setShowAddTransformer] = useState(false);
  const [transformerQuery, setTransformerQuery] = useState("");
  const [managementTab, setManagementTab] = useState<
    "transformers" | "contacts" | "firmware" | "sms_templates"
  >("transformers");

  const [editTransformer, setEditTransformer] = useState<Transformer | null>(
    null,
  );
  const [showEditTransformer, setShowEditTransformer] = useState(false);

  const [deleteTransformer, setDeleteTransformer] =
    useState<Transformer | null>(null);
  const [showDeleteTransformer, setShowDeleteTransformer] = useState(false);

  const [resetTargetTransformer, setResetTargetTransformer] =
    useState<Transformer | null>(null);
  const [showResetTransformer, setShowResetTransformer] = useState(false);

  const [activeTab, setActiveTab] = useState<NavKey>("monitoring");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const { toasts, toast, dismiss } = useToast();

  useEffect(() => {
    // Non-admin users cannot access management or users.
    if (!isAdmin && (activeTab === "management" || activeTab === "users"))
      setActiveTab("monitoring");
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
    setError(null);
    setTransformersLoading(true);
    void (async () => {
      try {
        await refreshTransformers();
      } catch (e) {
        console.error("Failed to fetch transformers:", e);
        setError("Failed to load transformers. Please refresh the page.");
      } finally {
        setTransformersLoading(false);
      }
    })();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (selectedId == null) return;
    setError(null);
    setDataLoading(true);
    setInsights24h(null);
    setRecentReadingsForSparkline([]);
    setLatestReading(null);
    setAlerts([]);
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
        setError("Failed to load readings and alerts for this transformer.");
      } finally {
        setDataLoading(false);
      }
    })();
  }, [selectedId]);

  if (!accessToken) {
    if (showRegister) {
      return (
        <RegisterDialog
          open={true}
          onClose={() => setShowRegister(false)}
          onBackToLogin={() => setShowRegister(false)}
        />
      );
    }
    return (
      <LoginDialog
        open={true}
        onClose={() => {}}
        onRegister={() => setShowRegister(true)}
      />
    );
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
      <TopBar
        transformers={transformers}
        selectedId={selectedId}
        selectedTransformer={selectedTransformer ?? null}
        onSelectTransformer={(id) => setSelectedId(id)}
        isAdmin={isAdmin}
        onAddTransformer={() => {
          setActiveTab("management");
          setShowAddTransformer(true);
        }}
        connected={deviceOnline}
        onLogout={logout}
        theme={theme}
        onToggleTheme={toggleTheme}
        unacknowledgedCount={unacknowledgedCount}
        onOpenMobileNav={() => setMobileNavOpen(true)}
        onOpenAlerts={() => setActiveTab("alerts")}
      />

      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent className="left-0 top-0 max-w-[min(86vw,20rem)] -translate-x-0 -translate-y-0 rounded-none p-0">
            <Sidebar
              active={activeTab}
              isAdmin={isAdmin}
              unacknowledgedCount={unacknowledgedCount}
              me={me}
              onLogout={logout}
              onNavigate={(key) => {
                setActiveTab(key);
                setMobileNavOpen(false);
              }}
            />
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <main className="flex gap-4 px-3 py-6 sm:gap-6 sm:px-4 md:px-6 lg:px-8">
        <aside
          className="hidden w-72 shrink-0 lg:block"
          aria-label="Sidebar navigation"
        >
          <div className="sticky top-[4.25rem] h-[calc(100vh-4.25rem)] overflow-y-auto rounded-lg border border-border/80 bg-card">
            <Sidebar
              active={activeTab}
              isAdmin={isAdmin}
              unacknowledgedCount={unacknowledgedCount}
              me={me}
              onLogout={logout}
              onNavigate={(key) => setActiveTab(key)}
            />
          </div>
        </aside>

        <div className="@container min-w-0 flex-1 space-y-6">
          {activeTab === "monitoring" ? (
            <MonitoringView
              transformers={transformers}
              selectedId={selectedId}
              selectedTransformer={selectedTransformer ?? null}
              reading={displayReading}
              connected={deviceOnline}
              loading={uiLoading}
              insights24h={insights24h}
              recentReadingsForSparkline={recentReadingsForSparkline}
              alerts={alerts}
              onSelectTransformer={(id) => setSelectedId(id)}
              error={error}
            />
          ) : activeTab === "alerts" ? (
            <div>
              <PageHeader
                title="Alerts"
                subtitle={
                  unacknowledgedCount > 0
                    ? `${unacknowledgedCount} unacknowledged`
                    : "All caught up"
                }
              />
              <AlertsList
                alerts={alerts}
                setAlerts={setAlerts}
                loading={uiLoading}
                transformerId={selectedId}
              />
            </div>
          ) : activeTab === "reports" ? (
            <div>
              <PageHeader
                title="Reports"
                subtitle="Historical data and export"
              />
              <ReportsView transformerId={selectedId} />
            </div>
          ) : activeTab === "users" ? (
            <div>
              <PageHeader
                title="Users"
                subtitle="Manage user access and approvals"
              />
              <UserManagementScreen />
            </div>
          ) : (
            /* management tab */
            <div
              role="tabpanel"
              id="tabpanel-management"
              aria-labelledby="tab-management"
            >
              <PageHeader
                title="Management"
                subtitle="Transformer configuration and contacts"
                action={
                  isAdmin && managementTab === "transformers" ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setShowAddTransformer(true)}
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
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Add Transformer
                    </Button>
                  ) : null
                }
              />

              {isAdmin ? (
                <>
                  {/* Sub-tab pill bar */}
                  <div className="mb-4 flex gap-1 rounded-lg border border-border/60 bg-muted/30 p-1 w-fit">
                    <button
                      type="button"
                      onClick={() => setManagementTab("transformers")}
                      className={[
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        managementTab === "transformers"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      Transformers
                    </button>
                    <button
                      type="button"
                      onClick={() => setManagementTab("contacts")}
                      className={[
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        managementTab === "contacts"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      Contacts
                    </button>
                    <button
                      type="button"
                      onClick={() => setManagementTab("firmware")}
                      className={[
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        managementTab === "firmware"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      Firmware
                    </button>
                    <button
                      type="button"
                      onClick={() => setManagementTab("sms_templates")}
                      className={[
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        managementTab === "sms_templates"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      SMS Templates
                    </button>
                  </div>

                  {managementTab === "transformers" && (
                    <div className="flex flex-col gap-3">
                      <input
                        className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        value={transformerQuery}
                        onChange={(e) => setTransformerQuery(e.target.value)}
                        placeholder="Search by name, serial, phone, or site..."
                        aria-label="Search transformers"
                      />
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
                        onReset={(t) => {
                          setResetTargetTransformer(t);
                          setShowResetTransformer(true);
                        }}
                      />
                    </div>
                  )}

                  {managementTab === "contacts" && <ContactsScreen />}

                  {managementTab === "firmware" && <FirmwarePanel />}

                  {managementTab === "sms_templates" && <SmsTemplatePanel />}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Management is restricted to admins.
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {isAdmin && (
        <AddTransformerDialog
          open={showAddTransformer}
          onClose={() => setShowAddTransformer(false)}
          onCreated={(t) => {
            void refreshTransformers(t.id);
            toast("Transformer added successfully.", "success");
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
            toast("Transformer updated.", "success");
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
            toast("Transformer deleted.", "info");
          }}
        />
      )}

      {isAdmin && (
        <ResetTransformerDialog
          open={showResetTransformer}
          transformer={resetTargetTransformer}
          onClose={() => {
            setShowResetTransformer(false);
            setResetTargetTransformer(null);
          }}
          onResetDone={(transformerId) => {
            const wasSelected = selectedId === transformerId;
            void (async () => {
              // Keep transformer list fresh (and ensure the selectedId still exists).
              await refreshTransformers();

              if (!wasSelected) return;

              // Force websocket re-subscription + re-fetch by toggling selectedId.
              setLatestReading(null);
              setAlerts([]);
              setInsights24h(null);
              setRecentReadingsForSparkline([]);
              setError(null);

              setSelectedId(null);
              requestAnimationFrame(() => setSelectedId(transformerId));
            })();
          }}
        />
      )}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
