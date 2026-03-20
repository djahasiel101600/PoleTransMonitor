import { useEffect, useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { createTransformer, type CreateTransformerPayload } from "../api/client";
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
  const [createdWithKey, setCreatedWithKey] = useState<Transformer | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [nominalVoltage, setNominalVoltage] = useState<number>(230);
  const [nominalFreq, setNominalFreq] = useState<number>(60);
  const [ratedKva, setRatedKva] = useState<number>(15);
  const [ratedCurrent, setRatedCurrent] = useState<number>(68);
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
      setError(err instanceof Error ? err.message : "Failed to create transformer");
    } finally {
      setSubmitting(false);
    }
  };

  if (createdWithKey?.device_api_key) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center">
        <Card className="w-full max-w-lg rounded-t-lg rounded-b-none sm:rounded-lg px-4 pb-4 sm:px-0 sm:pb-0 max-h-[85vh] overflow-y-auto">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Device API key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste this key into the ESP32 WiFi portal field <strong>Device API key (Dashboard → staff)</strong> so
              the device loads the same nominal voltage, frequency, and ratings as the dashboard.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                className="min-w-0 flex-1 rounded-md border border-border/80 bg-muted/30 px-3 py-2 font-mono text-xs outline-none"
                value={createdWithKey.device_api_key}
              />
              <Button type="button" variant="outline" onClick={() => void copyDeviceKey()}>
                Copy
              </Button>
            </div>
            {copyHint && <p className="text-xs text-muted-foreground">{copyHint}</p>}
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Store this key securely. You can copy it again anytime from Edit transformer (staff).
            </p>
            <div className="flex justify-end pt-2">
              <Button type="button" onClick={finishAfterKey}>
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center">
      <Card className="w-full max-w-lg rounded-t-lg rounded-b-none sm:rounded-lg px-4 pb-4 sm:px-0 sm:pb-0 max-h-[85vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Add Transformer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Name</label>
              <input
                className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Serial (optional)</label>
              <input
                className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Phone number (optional)</label>
              <input
                type="tel"
                autoComplete="tel"
                placeholder="e.g. +639171234567"
                className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">SIM / modem MSISDN for SMS or device identification</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Nominal voltage</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  value={nominalVoltage}
                  onChange={(e) => setNominalVoltage(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Nominal freq</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  value={nominalFreq}
                  onChange={(e) => setNominalFreq(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Rated kVA</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  value={ratedKva}
                  onChange={(e) => setRatedKva(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Rated current</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  value={ratedCurrent}
                  onChange={(e) => setRatedCurrent(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Site (optional)</label>
              <input
                className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={site}
                onChange={(e) => setSite(e.target.value)}
              />
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || name.trim().length === 0}>
                {submitting ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
