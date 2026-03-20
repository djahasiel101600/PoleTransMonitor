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
}: {
  transformers: Transformer[];
  selectedId: number | null;
  query: string;
  onSelect: (id: number) => void;
  onEdit: (t: Transformer) => void;
  onDelete: (t: Transformer) => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transformers;
    return transformers.filter((t) => {
      const name = (t.name ?? "").toLowerCase();
      const serial = (t.serial ?? "").toLowerCase();
      const site = (t.site ?? "").toLowerCase();
      return name.includes(q) || serial.includes(q) || site.includes(q);
    });
  }, [transformers, query]);

  if (filtered.length === 0) {
    return <div className="text-sm text-muted-foreground">No transformers found.</div>;
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
            } sm:flex-row sm:items-start`}
          >
            <button
              type="button"
              className="text-left w-full sm:w-auto"
              onClick={() => onSelect(t.id)}
              aria-label={`Select transformer ${t.name}`}
            >
              <div className="font-medium text-foreground">{t.name}</div>
              <div className="text-xs text-muted-foreground">
                {t.serial ? `Serial: ${t.serial} · ` : ""}
                {t.site ? `Site: ${t.site} · ` : ""}
                {t.rated_kva} kVA
              </div>
              <div className="text-[10px] text-muted-foreground">
                Nominal: {t.nominal_voltage}V @ {t.nominal_freq}Hz
              </div>
            </button>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onSelect(t.id)}
                className="w-full sm:w-auto"
              >
                {isSelected ? "Active" : "Use"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onEdit(t)}
                className="w-full sm:w-auto"
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onDelete(t)}
                className="border-red-200 text-red-600 hover:bg-red-50 w-full sm:w-auto"
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

