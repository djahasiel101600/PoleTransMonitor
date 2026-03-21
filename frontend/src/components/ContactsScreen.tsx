import { useEffect, useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { createContact, deleteContact, fetchContacts } from "../api/client";

type Contact = {
  id: number;
  owner_name: string;
  phone_number: string;
  created_at: string;
};

export function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const cs = (await fetchContacts()) as Contact[];
      setContacts(cs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createContact({
        owner_name: ownerName.trim(),
        phone_number: phoneNumber.trim(),
      });
      setOwnerName("");
      setPhoneNumber("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contact");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-0.5">
          <CardTitle className="text-base font-semibold">Contacts</CardTitle>
          <div className="text-xs text-muted-foreground">
            Unique by phone number (duplicates are rejected).
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
        >
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={submit}
          className="flex flex-col gap-3 md:flex-row md:items-end"
        >
          <div className="space-y-1 flex-1">
            <label className="text-sm font-medium text-foreground">
              Owner name
            </label>
            <input
              className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              required
            />
          </div>
          <div className="space-y-1 flex-1">
            <label className="text-sm font-medium text-foreground">
              Phone number
            </label>
            <input
              className="w-full rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+639xxxxxxxxx"
              required
            />
          </div>
          <div className="pt-1">
            <Button type="submit" disabled={submitting || loading}>
              {submitting ? "Adding..." : "Add contact"}
            </Button>
          </div>
        </form>

        {error && <div className="mt-3 text-sm text-destructive">{error}</div>}

        <div className="mt-6 space-y-2">
          {loading ? (
            <div className="text-sm text-muted-foreground">
              Loading contacts...
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No contacts yet.
            </div>
          ) : (
            contacts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/70 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {c.owner_name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.phone_number}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    if (!window.confirm(`Delete contact "${c.owner_name}"?`))
                      return;
                    try {
                      await deleteContact(c.id);
                      await refresh();
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Failed to delete contact",
                      );
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
