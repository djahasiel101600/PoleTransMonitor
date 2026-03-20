import { useEffect, useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { type CreateTransformerPayload, updateTransformer } from "../api/client";
import type { Transformer } from "../types";

export function EditTransformerDialog({
  open,
  onClose,
  transformer,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  transformer: Transformer | null;
  onUpdated: (t: Transformer) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [nominalVoltage, setNominalVoltage] = useState<number>(230);
  const [nominalFreq, setNominalFreq] = useState<number>(60);
  const [ratedKva, setRatedKva] = useState<number>(15);
  const [ratedCurrent, setRatedCurrent] = useState<number>(68);
  const [site, setSite] = useState("");

  useEffect(() => {
    if (!open || !transformer) return;
    setSubmitting(false);
    setError(null);
    setName(transformer.name ?? "");
    setSerial(transformer.serial ?? "");
    setNominalVoltage(transformer.nominal_voltage ?? 230);
    setNominalFreq(transformer.nominal_freq ?? 60);
    setRatedKva(transformer.rated_kva ?? 15);
    setRatedCurrent(transformer.rated_current ?? 68);
    setSite(transformer.site ?? "");
  }, [open, transformer]);

  if (!open || !transformer) return null;

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
      };

      if (!payload.name) throw new Error("Transformer name is required");

      const updated = await updateTransformer(transformer.id, payload);
      onUpdated(updated as Transformer);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update transformer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center">
      <Card className="w-full max-w-lg rounded-t-lg rounded-b-none sm:rounded-lg px-4 pb-4 sm:px-0 sm:pb-0 max-h-[85vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Edit Transformer</CardTitle>
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
                {submitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

