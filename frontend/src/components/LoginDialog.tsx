import { useEffect, useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { useAuth } from "../contexts/AuthContext";

export function LoginDialog({
  open,
  onClose,
  onLoggedIn,
}: {
  open: boolean;
  onClose: () => void;
  onLoggedIn?: () => void;
}) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUsername("");
    setPassword("");
    setError(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      onClose();
      onLoggedIn?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center">
      <Card className="w-full max-w-md rounded-t-lg rounded-b-none sm:rounded-lg sm:rounded-b-lg px-4 pb-4 sm:px-0 sm:pb-0 max-h-[85vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Admin login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Username</label>
              <input
                className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Password</label>
              <input
                type="password"
                className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || username.trim().length === 0}>
                {submitting ? "Logging in..." : "Login"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

