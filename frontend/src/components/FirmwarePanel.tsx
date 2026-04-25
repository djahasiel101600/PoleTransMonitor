import { useEffect, useRef, useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import {
  activateFirmwareRelease,
  deleteFirmwareRelease,
  fetchFirmwareReleases,
  uploadFirmwareRelease,
} from "../api/client";
import type { FirmwareRelease } from "../types";

export function FirmwarePanel() {
  const [releases, setReleases] = useState<FirmwareRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload form state
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    void fetchFirmwareReleases()
      .then(setReleases)
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Failed to load firmware releases",
        ),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const created = await uploadFirmwareRelease(version, file);
      setReleases((prev) => [created, ...prev]);
      setVersion("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (id: number) => {
    try {
      const updated = await activateFirmwareRelease(id);
      setReleases((prev) =>
        prev.map((r) => (r.id === id ? updated : { ...r, is_active: false })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to activate release",
      );
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteFirmwareRelease(id);
      setReleases((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete release");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="text-base font-semibold text-foreground">
          OTA Firmware
        </h2>
        <p className="text-xs text-muted-foreground">
          Upload and activate firmware releases. Devices poll every 30 minutes
          and self-update when the active version differs from their compiled
          version.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload form */}
        <form
          onSubmit={handleUpload}
          className="space-y-2 rounded-md border border-border/80 bg-muted/10 p-3"
        >
          <p className="text-sm font-medium text-foreground">
            Upload new release
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded-md border border-border/80 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Version (e.g. 1.0.1)"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              required
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".bin"
              required
              className="flex-1 text-sm text-foreground file:mr-2 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:text-primary-foreground"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="submit"
              disabled={uploading || !version.trim() || !file}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
          {uploadError && (
            <p role="alert" className="text-xs text-destructive">
              {uploadError}
            </p>
          )}
        </form>

        {/* Releases list */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : releases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No firmware releases yet.
          </p>
        ) : (
          <div className="divide-y divide-border/60 rounded-md border border-border/80">
            {releases.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">
                      {r.version}
                    </span>
                    {r.is_active && <Badge variant="normal">Active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.uploaded_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!r.is_active && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleActivate(r.id)}
                    >
                      Set Active
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleDelete(r.id)}
                    disabled={r.is_active}
                    title={
                      r.is_active
                        ? "Deactivate before deleting"
                        : "Delete release"
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
