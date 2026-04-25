import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { fetchSmsSettings, updateSmsSettings } from "../api/client";
import type { SmsSettings } from "../types";

// ---------------------------------------------------------------------------
// Supported template tokens and human-readable labels
// ---------------------------------------------------------------------------
const TOKENS: { token: string; label: string }[] = [
  { token: "{transformer}", label: "Transformer" },
  { token: "{voltage}", label: "Voltage" },
  { token: "{current}", label: "Current" },
  { token: "{apparent_power}", label: "Apparent Power" },
  { token: "{real_power}", label: "Real Power" },
  { token: "{power_factor}", label: "Power Factor" },
  { token: "{frequency}", label: "Frequency" },
  { token: "{energy_kwh}", label: "Energy (kWh)" },
  { token: "{oil_temp}", label: "Oil Temp" },
  { token: "{condition}", label: "Condition" },
];

// Sample values used for the live preview (no network call required)
const SAMPLE: Record<string, string> = {
  "{transformer}": "Transformer 1",
  "{voltage}": "219.5",
  "{current}": "28.3",
  "{apparent_power}": "6211",
  "{real_power}": "5837",
  "{power_factor}": "0.94",
  "{frequency}": "60.0",
  "{energy_kwh}": "123.45",
  "{oil_temp}": "47.2",
  "{condition}": "heavy_load",
};

function renderPreview(tpl: string): string {
  if (!tpl.trim()) return "(no template — firmware default will be used)";
  return tpl.replace(/\{[^}]+\}/g, (match) => SAMPLE[match] ?? match);
}

// ---------------------------------------------------------------------------
// Sub-component: a single template editor section (Alert or Status)
// ---------------------------------------------------------------------------
interface TemplateEditorProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

function TemplateEditor({
  label,
  value,
  onChange,
  textareaRef,
}: TemplateEditorProps) {
  const MAX = 220;
  const remaining = MAX - value.length;

  const insertToken = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    if (next.length > MAX) return;
    onChange(next);
    // Restore cursor after the inserted token
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label}
      </h3>

      {/* Token chips */}
      <div className="flex flex-wrap gap-1.5">
        {TOKENS.map(({ token, label: lbl }) => (
          <button
            key={token}
            type="button"
            onClick={() => insertToken(token)}
            className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200
                       dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-800/60
                       transition-colors cursor-pointer select-none"
            title={`Insert ${token}`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          maxLength={MAX}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Leave blank to use the firmware built-in default…"
          className="w-full rounded-md border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100
                     px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span
          className={`absolute bottom-2 right-3 text-xs ${
            remaining < 20 ? "text-red-500" : "text-gray-400"
          }`}
        >
          {remaining} remaining
        </span>
      </div>

      {/* Live preview */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Preview (sample values)
        </p>
        <div
          className="rounded-md border border-dashed border-gray-300 dark:border-gray-600
                     bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-xs
                     text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words min-h-[2.5rem]"
        >
          {renderPreview(value)}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export function SmsTemplatePanel() {
  const [alertTpl, setAlertTpl] = useState("");
  const [statusTpl, setStatusTpl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const alertRef = useRef<HTMLTextAreaElement | null>(null);
  const statusRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void fetchSmsSettings()
      .then((s: SmsSettings) => {
        setAlertTpl(s.alert_template);
        setStatusTpl(s.status_template);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Failed to load SMS settings",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateSmsSettings({
        alert_template: alertTpl,
        status_template: statusTpl,
      });
      setAlertTpl(updated.alert_template);
      setStatusTpl(updated.status_template);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save SMS settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          SMS Templates
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Customise the SMS message sent on alert and in response to a status
          request. Leave blank to use the firmware built-in default. Changes
          take effect on the device&apos;s next config sync.
        </p>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <div className="space-y-8">
            <TemplateEditor
              label="Alert Template"
              value={alertTpl}
              onChange={setAlertTpl}
              textareaRef={alertRef}
            />
            <TemplateEditor
              label="Status Reply Template"
              value={statusTpl}
              onChange={setStatusTpl}
              textareaRef={statusRef}
            />

            {/* Feedback + Save */}
            <div className="flex items-center gap-4 pt-2">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving…" : "Save Templates"}
              </Button>
              {success && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  Saved successfully.
                </span>
              )}
              {error && (
                <span className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
