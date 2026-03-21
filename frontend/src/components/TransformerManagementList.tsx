import { useMemo } from "react";
import type { Transformer } from "../types";
import { Button } from "./ui/Button";

export function TransformerManagementList({
  transformers,
  selectedId,
  query,
  onSelect,
  onEdit,
  onDelete,
  onReset,
}: {
  transformers: Transformer[];
  selectedId: number | null;
  query: string;
  onSelect: (id: number) => void;
  onEdit: (t: Transformer) => void;
  onDelete: (t: Transformer) => void;
  onReset: (t: Transformer) => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transformers;
    return transformers.filter((t) => {
      const name = (t.name ?? "").toLowerCase();
      const serial = (t.serial ?? "").toLowerCase();
      const site = (t.site ?? "").toLowerCase();
      const phone = (t.phone_number ?? "").toLowerCase();
      return (
        name.includes(q) ||
        serial.includes(q) ||
        site.includes(q) ||
        phone.includes(q)
      );
    });
  }, [transformers, query]);

  if (filtered.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No transformers found.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((t) => {
        const isSelected = selectedId === t.id;
        return (
          <div
            key={t.id}
            className={`flex flex-col items-stretch justify-between gap-3 rounded-md border border-border/80 bg-card p-3 ${
              isSelected ? "ring-2 ring-primary/30" : ""
            } md:flex-row md:items-start`}
          >
            <button
              type="button"
              className="text-left w-full md:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => onSelect(t.id)}
              aria-label={`Select transformer ${t.name}`}
            >
              <div className="font-medium text-foreground">{t.name}</div>
              <div className="text-xs text-muted-foreground">
                {t.serial ? `Serial: ${t.serial} · ` : ""}
                {t.phone_number ? `Phone: ${t.phone_number} · ` : ""}
                {t.site ? `Site: ${t.site} · ` : ""}
                {t.rated_kva} kVA
              </div>
              <div className="text-[10px] text-muted-foreground">
                Nominal: {t.nominal_voltage}V @ {t.nominal_freq}Hz
              </div>
            </button>

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onSelect(t.id)}
                className="w-full md:w-auto"
              >
                {isSelected ? "Active" : "Use"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onEdit(t)}
                className="w-full md:w-auto"
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onReset(t)}
                className="w-full md:w-auto border-amber-200 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300"
              >
                Reset
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onDelete(t)}
                className="border-destructive text-destructive hover:bg-destructive/10 w-full md:w-auto"
              >
                Delete
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
