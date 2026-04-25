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
import { resetTransformer } from "../api/client";
import type { Transformer } from "../types";

export function ResetTransformerDialog({
  open,
  onClose,
  transformer,
  onResetDone,
}: {
  open: boolean;
  onClose: () => void;
  transformer: Transformer | null;
  onResetDone: (transformerId: number) => void;
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
      await resetTransformer(transformer.id);
      onResetDone(transformer.id);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reset transformer",
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
            <CardHeader className="space-y-1">
              <DialogTitle>Reset Transformer</DialogTitle>
              <div className="text-xs text-muted-foreground">
                Clears readings/alerts and re-zeroes dashboard energy.
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm text-foreground">
                  Reset <span className="font-medium">{transformer.name}</span>?
                </div>
                <div className="text-xs text-muted-foreground">
                  This will delete stored readings and alerts for this
                  transformer, and reset the energy counter. The PZEM hardware
                  energy accumulator will also be remotely reset on the device's
                  next config sync.
                </div>
                <div className="text-xs text-muted-foreground">
                  Use this when a transformer/PZEM module was replaced or the
                  energy counter needs re-zeroing.
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
                    onClick={() => void confirm()}
                    disabled={submitting}
                    className="border-destructive text-destructive hover:bg-destructive/10"
                  >
                    {submitting ? "Resetting..." : "Reset"}
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
