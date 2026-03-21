import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "./ui/Dialog";
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
      setError(
        err instanceof Error ? err.message : "Failed to delete transformer",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogContent>
          <Card className="w-full rounded-lg max-h-[85vh] overflow-y-auto">
            <CardHeader>
              <DialogTitle>Delete Transformer</DialogTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm text-foreground">
                  Are you sure you want to delete{" "}
                  <span className="font-medium">{transformer.name}</span>?
                </div>
                {transformer.phone_number && (
                  <div className="text-xs text-muted-foreground">
                    Phone: {transformer.phone_number}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  This will also delete related readings and alerts (cascade
                  delete).
                </div>
                {error && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="text-sm text-destructive"
                  >
                    {error}
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={confirm}
                    disabled={submitting}
                    className="border-destructive text-destructive hover:bg-destructive/10"
                  >
                    {submitting ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
