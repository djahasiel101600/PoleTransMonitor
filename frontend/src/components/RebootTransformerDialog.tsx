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
import { rebootTransformer } from "../api/client";
import type { Transformer } from "../types";

export function RebootTransformerDialog({
  open,
  onClose,
  transformer,
  onRebooted,
}: {
  open: boolean;
  onClose: () => void;
  transformer: Transformer | null;
  onRebooted: (transformerId: number) => void;
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
      await rebootTransformer(transformer.id);
      onRebooted(transformer.id);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send reboot command",
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
              <DialogTitle>Reboot Device</DialogTitle>
              <div className="text-xs text-muted-foreground">
                Sends a remote reboot command to the ESP32.
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm text-foreground">
                  Reboot <span className="font-medium">{transformer.name}</span>
                  ?
                </div>
                <div className="text-xs text-muted-foreground">
                  The device will pick up the reboot command on its next config
                  sync (within 15 minutes) and restart automatically. Live
                  readings will be interrupted briefly while the device
                  reconnects.
                </div>
                <div className="text-xs text-muted-foreground">
                  Use this to apply new WiFi credentials or recover a stuck
                  device without physical access.
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
                    className="border-blue-200 bg-blue-600 text-white hover:bg-blue-700 dark:border-blue-800"
                  >
                    {submitting ? "Sending…" : "Reboot"}
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
