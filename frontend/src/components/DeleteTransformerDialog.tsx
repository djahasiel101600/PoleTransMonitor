import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { deleteTransformer } from "../api/client";
import type { Transformer } from "../types";

export function DeleteTransformerDialog({
  open,
  onClose,
  transformer,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  transformer: Transformer | null;
  onDeleted: (id: number) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setError(null);
  }, [open]);

  if (!open || !transformer) return null;

  const confirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await deleteTransformer(transformer.id);
      onDeleted(transformer.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete transformer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center">
      <Card className="w-full max-w-md rounded-t-lg rounded-b-none sm:rounded-lg px-4 pb-4 sm:px-0 sm:pb-0 max-h-[85vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Delete Transformer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm text-foreground">
              Are you sure you want to delete <span className="font-medium">{transformer.name}</span>?
            </div>
            {transformer.phone_number && (
              <div className="text-xs text-muted-foreground">Phone: {transformer.phone_number}</div>
            )}
            <div className="text-xs text-muted-foreground">
              This will also delete related readings and alerts (cascade delete).
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirm}
                disabled={submitting}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                {submitting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

