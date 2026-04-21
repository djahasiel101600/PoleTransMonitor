import type { Toast, ToastVariant } from "../../hooks/useToast";

const variantStyles: Record<
  ToastVariant,
  { bar: string; icon: string; bg: string; text: string }
> = {
  success: {
    bar: "bg-green-500",
    icon: "text-green-600 dark:text-green-400",
    bg: "bg-card border-green-200 dark:border-green-800",
    text: "text-foreground",
  },
  error: {
    bar: "bg-red-500",
    icon: "text-red-600 dark:text-red-400",
    bg: "bg-card border-red-200 dark:border-red-800",
    text: "text-foreground",
  },
  info: {
    bar: "bg-primary",
    icon: "text-primary",
    bg: "bg-card border-border/80",
    text: "text-foreground",
  },
};

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const cls = variantStyles[variant].icon;
  if (variant === "success")
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-4 w-4 shrink-0 ${cls}`}
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  if (variant === "error")
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-4 w-4 shrink-0 ${cls}`}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 ${cls}`}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => {
        const s = variantStyles[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className={`flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 overflow-hidden rounded-xl border shadow-lg ${s.bg} animate-fade-in`}
          >
            {/* Colour bar */}
            <div
              className={`w-1 shrink-0 self-stretch rounded-l-xl ${s.bar}`}
            />
            <div className="flex flex-1 items-start gap-2 py-3 pr-1">
              <ToastIcon variant={t.variant} />
              <p className={`flex-1 text-sm ${s.text}`}>{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              className="mr-2 mt-2.5 shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
