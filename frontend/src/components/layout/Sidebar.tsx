import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

export type NavKey = "monitoring" | "management";

function NavIcon({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground">{children}</span>;
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
    <nav className="flex h-full flex-col gap-4 p-4">
      <div className="space-y-1">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Navigation</div>
        <div className="text-sm text-muted-foreground">Energy monitoring control</div>
      </div>

      <div className="space-y-2">
        <NavButton
          active={active === "monitoring"}
          onClick={() => onNavigate("monitoring")}
          label="Monitoring"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
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
          active={active === "management"}
          disabled={!isAdmin}
          onClick={() => isAdmin && onNavigate("management")}
          label="Transformer Management"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.5 5 5.5.8-4 3.9 1 5.6L12 15.9 6.9 18.3l1-5.6-4-3.9 5.5-.8z" />
            </svg>
          }
        />
      </div>

      <div className="mt-auto text-xs text-muted-foreground">
        Tip: Use the transformer selector in the header to switch devices.
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
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      disabled={disabled}
      className={[
        "h-auto w-full justify-start gap-3 rounded-lg px-3 py-2",
        active ? "border-primary/40" : "border-border/80 bg-background/0",
        disabled ? "opacity-60" : "",
      ].join(" ")}
    >
      <NavIcon>{icon}</NavIcon>
      <span className="flex-1 text-left text-sm font-medium">{label}</span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </Button>
  );
}

