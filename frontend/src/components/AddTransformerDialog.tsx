import { useEffect, useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "./ui/Dialog";
import { Input } from "./ui/Input";
import { Label } from "./ui/Label";
import {
  createTransformer,
  type CreateTransformerPayload,
} from "../api/client";
import type { Transformer } from "../types";

export function AddTransformerDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (t: Transformer) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** After create, staff may need to copy device API key into the ESP32 portal */
  const [createdWithKey, setCreatedWithKey] = useState<Transformer | null>(
    null,
  );
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [nominalVoltage, setNominalVoltage] = useState<number>(230);
  const [nominalFreq, setNominalFreq] = useState<number>(60);
  const [ratedKva, setRatedKva] = useState<number>(15);
  const [ratedCurrent, setRatedCurrent] = useState<number>(68);
  const [readingIntervalMinutes, setReadingIntervalMinutes] =
    useState<number>(0);
  const [site, setSite] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setError(null);
    setCreatedWithKey(null);
    setCopyHint(null);
    setName("");
    setSerial("");
    setNominalVoltage(230);
    setNominalFreq(60);
    setRatedKva(15);
    setRatedCurrent(68);
    setReadingIntervalMinutes(0);
    setSite("");
    setPhoneNumber("");
  }, [open]);

  if (!open) return null;

  const finishAfterKey = () => {
    if (createdWithKey) {
      onCreated(createdWithKey);
      setCreatedWithKey(null);
    }
    onClose();
  };

  const copyDeviceKey = async () => {
    const k = createdWithKey?.device_api_key;
    if (!k) return;
    try {
      await navigator.clipboard.writeText(k);
      setCopyHint("Copied to clipboard");
      setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setCopyHint("Copy failed — select the field manually");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload: CreateTransformerPayload = {
        name: name.trim(),
        serial: serial.trim().length ? serial.trim() : null,
        nominal_voltage: Number(nominalVoltage),
        nominal_freq: Number(nominalFreq),
        rated_kva: Number(ratedKva),
        rated_current: Number(ratedCurrent),
        reading_interval_minutes: Math.max(0, Number(readingIntervalMinutes)),
        site: site.trim().length ? site.trim() : null,
        phone_number: phoneNumber.trim().length ? phoneNumber.trim() : null,
      };

      if (!payload.name) throw new Error("Transformer name is required");

      const created = await createTransformer(payload);
      const t = created as Transformer;
      if (t.device_api_key) {
        setCreatedWithKey(t);
        return;
      }
      onCreated(t);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create transformer",
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
            {createdWithKey?.device_api_key ? (
              <>
                <CardHeader>
                  <DialogTitle>Device API key</DialogTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Paste this key into the ESP32 WiFi portal field{" "}
                    <strong>Device API key (Dashboard → staff)</strong> so the
                    device loads the same nominal voltage, frequency, and
                    ratings as the dashboard.
                  </p>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <Label htmlFor="device-api-key">Device API key</Label>
                      <Input
                        id="device-api-key"
                        readOnly
                        autoFocus
                        className="bg-muted/30 font-mono text-xs"
                        value={createdWithKey.device_api_key}
                      />
                    </div>
                    <div className="pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copyDeviceKey()}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  {copyHint && (
                    <p
                      role="status"
                      aria-live="polite"
                      className="text-xs text-muted-foreground"
                    >
                      {copyHint}
                    </p>
                  )}
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Store this key securely. You can copy it again anytime from
                    Edit transformer (staff).
                  </p>
                  <div className="flex justify-end pt-2">
                    <Button type="button" onClick={finishAfterKey}>
                      Done
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <DialogTitle>Add Transformer</DialogTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submit} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="add-transformer-name">Name</Label>
                      <Input
                        id="add-transformer-name"
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="add-transformer-serial">
                        Serial (optional)
                      </Label>
                      <Input
                        id="add-transformer-serial"
                        value={serial}
                        onChange={(e) => setSerial(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="add-transformer-phone">
                        Phone number (optional)
                      </Label>
                      <Input
                        id="add-transformer-phone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="e.g. +639171234567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        SIM / modem MSISDN for SMS or device identification
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="add-transformer-nominal-voltage">
                          Nominal voltage
                        </Label>
                        <Input
                          id="add-transformer-nominal-voltage"
                          type="number"
                          step="0.1"
                          value={nominalVoltage}
                          onChange={(e) =>
                            setNominalVoltage(Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="add-transformer-nominal-freq">
                          Nominal freq
                        </Label>
                        <Input
                          id="add-transformer-nominal-freq"
                          type="number"
                          step="0.1"
                          value={nominalFreq}
                          onChange={(e) =>
                            setNominalFreq(Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="add-transformer-rated-kva">
                          Rated kVA
                        </Label>
                        <Input
                          id="add-transformer-rated-kva"
                          type="number"
                          step="0.1"
                          value={ratedKva}
                          onChange={(e) => setRatedKva(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="add-transformer-rated-current">
                          Rated current
                        </Label>
                        <Input
                          id="add-transformer-rated-current"
                          type="number"
                          step="0.1"
                          value={ratedCurrent}
                          onChange={(e) =>
                            setRatedCurrent(Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="add-transformer-reading-interval">
                          Reading save interval (minutes)
                        </Label>
                        <Input
                          id="add-transformer-reading-interval"
                          type="number"
                          min={0}
                          step={1}
                          value={readingIntervalMinutes}
                          onChange={(e) =>
                            setReadingIntervalMinutes(
                              Math.max(0, Number(e.target.value) || 0),
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          0 saves every incoming reading. Example: 15 aggregates
                          readings and stores one averaged row every 15 minutes.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="add-transformer-site">
                        Site (optional)
                      </Label>
                      <Input
                        id="add-transformer-site"
                        value={site}
                        onChange={(e) => setSite(e.target.value)}
                      />
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
                        type="submit"
                        disabled={submitting || name.trim().length === 0}
                      >
                        {submitting ? "Creating..." : "Create"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </>
            )}
          </Card>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
