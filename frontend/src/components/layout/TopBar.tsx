import type { Transformer } from "../../types";
import { Button } from "../ui/Button";

export function TopBar({
  transformers,
  selectedId,
  selectedTransformer,
  onSelectTransformer,
  isAdmin,
  onAddTransformer,
  connected,
  onLogout,
  theme,
  onToggleTheme,
  unacknowledgedCount,
  onOpenMobileNav,
  onOpenAlerts,
}: {
  transformers: Transformer[];
  selectedId: number | null;
  selectedTransformer: Transformer | null;
  onSelectTransformer: (id: number | null) => void;
  isAdmin: boolean;
  onAddTransformer: () => void;
  connected: boolean;
  onLogout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  unacknowledgedCount: number;
  onOpenMobileNav: () => void;
  onOpenAlerts: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Left section */}
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenMobileNav}
            className="h-8 w-8 p-0 lg:hidden"
            aria-label="Open main navigation menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          </Button>

          {/* Connection status */}
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                connected
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-primary animate-pulse-dot" : "bg-current opacity-40"}`}
              />
              {connected ? "Live" : "Offline"}
            </span>
          </div>

          {selectedTransformer && (
            <div className="hidden min-w-0 sm:block">
              <span className="text-xs text-muted-foreground">
                {selectedTransformer.rated_kva} kVA @{" "}
                {selectedTransformer.nominal_voltage}V
              </span>
            </div>
          )}
        </div>

        {/* Center: Transformer selector */}
        <div className="flex flex-1 items-center justify-center">
          <div className="relative">
            <label className="sr-only" htmlFor="transformer-select">
              Select transformer
            </label>
            <select
              id="transformer-select"
              value={selectedId ?? ""}
              onChange={(e) =>
                onSelectTransformer(Number(e.target.value) || null)
              }
              className="h-8 rounded-lg border border-border/80 bg-card px-3 pr-8 text-sm font-medium text-foreground outline-none transition-colors hover:border-primary/30 focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select transformer...</option>
              {transformers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.serial ? ` · ${t.serial}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1.5">
          {isAdmin && (
            <Button
              type="button"
              size="sm"
              onClick={onAddTransformer}
              className="hidden h-8 gap-1.5 text-xs sm:inline-flex"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add
            </Button>
          )}

          {unacknowledgedCount > 0 && (
            <button
              type="button"
              onClick={onOpenAlerts}
              className="hidden items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50 sm:inline-flex"
              aria-label={`${unacknowledgedCount} unacknowledged alert${unacknowledgedCount !== 1 ? "s" : ""}, click to view`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unacknowledgedCount} alert{unacknowledgedCount !== 1 ? "s" : ""}
            </button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={onToggleTheme}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            className="h-8 w-8 p-0"
          >
            {theme === "dark" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4 w-4"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-4 w-4"
              >
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onLogout}
            className="h-8 gap-1.5 px-2.5 text-xs"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-3.5 w-3.5"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
