import { useCallback, useEffect, useState } from "react";
import { fetchUsers, approveUser, deleteUser, type AppUser } from "../api/client";
import { Button } from "./ui/Button";

export function UserManagementScreen() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async (user: AppUser) => {
    setPendingAction(user.id);
    try {
      const updated = await approveUser(user.id);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve user.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    setPendingAction(target.id);
    try {
      await deleteUser(target.id);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete user.");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Approve or remove users who have registered.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No users found.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Username</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{user.username}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.is_superuser ? (
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                        Superuser
                      </span>
                    ) : user.is_staff ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        Staff
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        User
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.is_approved ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.date_joined).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {!user.is_approved && (
                        <Button
                          size="sm"
                          disabled={pendingAction === user.id}
                          onClick={() => void handleApprove(user)}
                        >
                          Approve
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={pendingAction === user.id}
                        onClick={() => setConfirmDelete(user)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-border/80 bg-card p-6 shadow-lg">
            <h3 className="text-base font-semibold text-foreground">Delete user?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This will permanently remove{" "}
              <span className="font-medium text-foreground">{confirmDelete.username}</span>. This
              action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => void handleDeleteConfirmed()}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
