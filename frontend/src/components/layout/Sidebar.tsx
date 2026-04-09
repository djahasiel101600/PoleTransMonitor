import type { ReactNode } from "react";
import { Badge } from "../ui/Badge";

export type NavKey = "monitoring" | "management" | "reports";

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
      {children}
    </span>
  );
}

export function Sidebar({
  active,
  isAdmin,
  unacknowledgedCount,
  onNavigate,
}: {
  active: NavKey;
  isAdmin: boolean;
  unacknowledgedCount: number;
  onNavigate: (key: NavKey) => void;
}) {
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      {/* Branding */}
      <div className="mb-3 flex items-center gap-2.5 px-2 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-primary"
          >
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">
            PoleTransMonitor
          </div>
          <div className="text-[11px] text-muted-foreground">
            Energy monitoring
          </div>
        </div>
      </div>

      <div className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Main
      </div>

      <NavButton
        active={active === "monitoring"}
        onClick={() => onNavigate("monitoring")}
        label="Monitoring"
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 3v18h18" />
            <path d="M7 14l3-3 3 2 4-5" />
          </svg>
        }
        trailing={
          unacknowledgedCount > 0 ? (
            <Badge variant="normal">{unacknowledgedCount}</Badge>
          ) : null
        }
      />

      <NavButton
        active={active === "reports"}
        onClick={() => onNavigate("reports")}
        label="Reports"
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        }
      />

      <div className="my-2 border-t border-border/60" />

      <div className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Admin
      </div>

      <NavButton
        active={active === "management"}
        disabled={!isAdmin}
        onClick={() => isAdmin && onNavigate("management")}
        label="Management"
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        }
      />

      <div className="mt-auto rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
        <p className="text-[11px] text-muted-foreground">
          Select a transformer from the header dropdown to begin monitoring.
        </p>
      </div>
    </nav>
  );
}

function NavButton({
  active,
  disabled,
  onClick,
  label,
  icon,
  trailing,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <NavIcon>{icon}</NavIcon>
      <span className="flex-1 text-left">{label}</span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </button>
  );
}
