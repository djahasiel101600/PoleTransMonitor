import { useEffect, useState, type FormEvent } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Label } from "./ui/Label";
import { useAuth } from "../contexts/AuthContext";
import { registerUser } from "../api/client";

type Props = {
  open: boolean;
  onClose: () => void;
  onBackToLogin: () => void;
};

export function RegisterDialog({ open, onClose, onBackToLogin }: Props) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUsername("");
    setPassword("");
    setPassword2("");
    setError(null);
    setPendingMessage(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== password2) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const data = await registerUser(username, password, password2);
      if (data.access && data.refresh) {
        // First user — auto sign-in via stored tokens then login flow.
        try {
          localStorage.setItem("accessToken", data.access);
          localStorage.setItem("refreshToken", data.refresh);
        } catch {
          // ignore
        }
        await login(username, password);
        onClose();
      } else {
        setPendingMessage(data.detail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-4 w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-primary"
            >
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            PoleTransMonitor
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Transformer monitoring dashboard
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm">
          {pendingMessage ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 text-yellow-600 dark:text-yellow-400"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">
                Account pending approval
              </p>
              <p className="text-xs text-muted-foreground">{pendingMessage}</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={onBackToLogin}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="text-base font-semibold text-foreground">
                  Create account
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fill in the details below to register
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-username">Username</Label>
                  <Input
                    id="reg-username"
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="Choose a username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password2">Confirm password</Label>
                  <Input
                    id="reg-password2"
                    type="password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    username.trim().length === 0 ||
                    password.length === 0
                  }
                  className="w-full"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Creating account...
                    </span>
                  ) : (
                    "Create account"
                  )}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Pole-mounted transformer energy monitoring system
        </p>
      </div>
    </div>
  );
}
