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
import {
  fetchContacts,
  type CreateTransformerPayload,
  updateTransformer,
} from "../api/client";
import { useAuth } from "../contexts/AuthContext";
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
  const { isAdmin } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [nominalVoltage, setNominalVoltage] = useState<number>(230);
  const [nominalFreq, setNominalFreq] = useState<number>(60);
  const [ratedKva, setRatedKva] = useState<number>(15);
  const [ratedCurrent, setRatedCurrent] = useState<number>(68);
  const [site, setSite] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [contacts, setContacts] = useState<
    Array<{ id: number; owner_name: string; phone_number: string }>
  >([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>(
    [],
  );
  const [contactsLoading, setContactsLoading] = useState(false);

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
    setPhoneNumber(transformer.phone_number ?? "");
    setIsActive(transformer.is_active ?? true);
    setSelectedRecipientIds(
      (transformer.sms_recipients ?? []).map((r) => r.id),
    );
  }, [open, transformer]);

  useEffect(() => {
    if (!open || !isAdmin) return;
    setContactsLoading(true);
    void fetchContacts()
      .then((cs) => setContacts(cs))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load contacts"),
      )
      .finally(() => setContactsLoading(false));
  }, [open, isAdmin]);

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
        phone_number: phoneNumber.trim().length ? phoneNumber.trim() : null,
        is_active: isActive,
        sms_recipients_ids: selectedRecipientIds,
      };

      if (!payload.name) throw new Error("Transformer name is required");

      const updated = await updateTransformer(transformer.id, payload);
      onUpdated(updated as Transformer);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update transformer",
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
              <DialogTitle>Edit Transformer</DialogTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-3">
                {isAdmin && (
                  <div className="space-y-1 rounded-md border border-border/80 bg-muted/20 p-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium text-foreground">
                        Device is {isActive ? "Active" : "Deactivated"}
                      </span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      When deactivated, the server rejects incoming readings and
                      the ESP32 stops sending measurements until reactivated.
                    </p>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    Name
                  </label>
                  <input
                    className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    Serial (optional)
                  </label>
                  <input
                    className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    Phone number (optional)
                  </label>
                  <input
                    type="tel"
                    autoComplete="tel"
                    placeholder="e.g. +639171234567"
                    className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    SIM / modem MSISDN for SMS or device identification
                  </p>
                </div>

                {isAdmin && (
                  <div className="space-y-2 rounded-md border border-border/80 bg-muted/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-foreground">
                        Alert recipients
                      </label>
                      {contactsLoading && (
                        <span className="text-xs text-muted-foreground">
                          Loading…
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedRecipientIds.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          No recipients selected.
                        </span>
                      ) : (
                        contacts
                          .filter((c) => selectedRecipientIds.includes(c.id))
                          .map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background px-3 py-1 text-xs"
                            >
                              {c.owner_name} — {c.phone_number}
                              <button
                                type="button"
                                aria-label={`Remove recipient ${c.phone_number}`}
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  setSelectedRecipientIds((prev) =>
                                    prev.filter((id) => id !== c.id),
                                  )
                                }
                              >
                                ×
                              </button>
                            </span>
                          ))
                      )}
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {contacts.map((c) => {
                        const checked = selectedRecipientIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-background/70 px-3 py-2"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setSelectedRecipientIds((prev) =>
                                  on
                                    ? [...prev, c.id]
                                    : prev.filter((id) => id !== c.id),
                                );
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground">
                                {c.owner_name}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {c.phone_number}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Nominal voltage
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      value={nominalVoltage}
                      onChange={(e) =>
                        setNominalVoltage(Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Nominal freq
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      value={nominalFreq}
                      onChange={(e) => setNominalFreq(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Rated kVA
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      value={ratedKva}
                      onChange={(e) => setRatedKva(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      Rated current
                    </label>
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
                  <label className="text-sm font-medium text-foreground">
                    Site (optional)
                  </label>
                  <input
                    className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                  />
                </div>

                {isAdmin && transformer.device_api_key && (
                  <div className="space-y-1 rounded-md border border-border/80 bg-muted/20 p-3">
                    <label
                      htmlFor="edit-device-api-key"
                      className="text-sm font-medium text-foreground"
                    >
                      Device API key (ESP32 portal)
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Paste into WiFi config field &quot;Device API key&quot;.
                      Device uses this to sync nameplate values from the server.
                    </p>
                    <div className="flex gap-2">
                      <input
                        id="edit-device-api-key"
                        readOnly
                        className="min-w-0 flex-1 rounded-md border border-border/80 bg-background px-3 py-2 font-mono text-xs outline-none"
                        value={transformer.device_api_key}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(transformer.device_api_key ?? "")
                            .then(
                              () => {
                                setCopyHint("Copied");
                                setTimeout(() => setCopyHint(null), 2000);
                              },
                              () => setCopyHint("Copy failed"),
                            );
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    {copyHint && (
                      <p className="text-xs text-muted-foreground">
                        {copyHint}
                      </p>
                    )}
                  </div>
                )}

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
                    {submitting ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
