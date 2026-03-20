import type { Transformer } from "../../types";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

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
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenMobileNav}
            className="lg:hidden"
            aria-label="Open navigation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          </Button>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground">Energy Monitoring Dashboard</h1>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {connected ? "Live feed active" : "No live feed"}{selectedTransformer ? ` · ${selectedTransformer.name}` : ""}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="transformer-select">
              Select transformer
            </label>
            <select
              id="transformer-select"
              aria-label="Select transformer"
              value={selectedId ?? ""}
              onChange={(e) => onSelectTransformer(Number(e.target.value) || null)}
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
            {selectedTransformer ? (
              <span className="hidden whitespace-nowrap text-sm text-muted-foreground sm:inline">
                {selectedTransformer.rated_kva} kVA
                {selectedTransformer.nominal_voltage ? ` @ ${selectedTransformer.nominal_voltage}V` : ""}
              </span>
            ) : null}
          </div>

          <Button
            type="button"
            variant={isAdmin ? "default" : "outline"}
            disabled={!isAdmin}
            onClick={onAddTransformer}
            className="h-9"
          >
            Add Transformer
          </Button>

          {unacknowledgedCount > 0 ? (
            <Badge variant="normal" className="hidden sm:inline-flex">
              {unacknowledgedCount} new
            </Badge>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="h-9 w-9 p-0"
          >
            {theme === "dark" ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636" />
                <path d="M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </Button>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                connected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-primary animate-pulse-dot" : "bg-current opacity-50"}`}
                aria-hidden
              />
              {connected ? "Live" : "Offline"}
            </span>

            <Button type="button" variant="outline" onClick={onLogout} className="h-9">
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

