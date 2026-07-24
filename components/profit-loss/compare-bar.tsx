"use client";

import { Check, Layers2, Plus } from "lucide-react";
import { useState } from "react";
import { Dropdown, DropdownPanel, DropdownTrigger } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Toolbar, ToolbarLabel } from "@/components/ui/toolbar";
import { cn } from "@/lib/cn";
import type { CompareDimension, SelectionEntryOption } from "@/lib/profit-loss/charts/selection";
import { usePygAnalytics } from "./pyg-analytics-provider";

const DIMS: { value: CompareDimension; label: string }[] = [
  { value: "nada", label: "Nada" },
  { value: "cuentas", label: "Cuentas" },
  { value: "centros", label: "Centros" },
  { value: "periodos", label: "Periodos" },
  { value: "niveles", label: "Niveles" },
];

const CROSS: { value: CompareDimension; label: string }[] = [
  { value: "nada", label: "Ninguno" },
  { value: "cuentas", label: "Cuentas" },
  { value: "centros", label: "Centros" },
  { value: "periodos", label: "Periodos" },
  { value: "niveles", label: "Niveles" },
];

const labelOf = (dim: CompareDimension) =>
  DIMS.find((option) => option.value === dim)?.label ?? "Nada";

/**
 * "Comparar por", now wired to `usePygAnalytics()`. Its shape has not changed: picking a
 * dimension reveals the series controls, and the panel of the tab reads the SAME selection —
 * the box and the charts cannot disagree because there is only one state.
 */
export function CompareBar() {
  const { selection, entryOptions, pickedIds, comparison, setDimension, setCross, toggleEntry } =
    usePygAnalytics();
  const active = selection.dimension !== "nada";
  const picked = pickedIds.size;

  return (
    <Toolbar tone="sunken">
      <ToolbarLabel>Comparar por</ToolbarLabel>
      <SegmentedControl
        variant="track"
        className="bg-surface"
        ariaLabel="Comparar por dimensión"
        options={DIMS}
        value={selection.dimension}
        onChange={setDimension}
      />

      {active && (
        <>
          <AddSeries
            dimLabel={labelOf(selection.dimension)}
            options={entryOptions}
            picked={pickedIds}
            onToggle={toggleEntry}
          />

          <span className="h-[22px] w-px bg-chip-border" />

          <Dropdown>
            <DropdownTrigger icon={<Layers2 size={14} />} active={selection.cross !== "nada"}>
              {selection.cross === "nada" ? "Y también por" : labelOf(selection.cross)}
            </DropdownTrigger>
            <DropdownPanel width={224}>
              <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faintest">
                Y también por (cruce)
              </div>
              <div className="-mx-1">
                {CROSS.filter((option) => option.value !== selection.dimension).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCross(option.value)}
                    className={cn(
                      "flex w-full items-center rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors",
                      selection.cross === option.value
                        ? "bg-brand-soft font-medium text-brand"
                        : "text-ink hover:bg-canvas",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </DropdownPanel>
          </Dropdown>

          <span
            className={cn(
              "ml-auto text-[11.5px] font-medium",
              // The engine truncates deterministically past eight; saying so beats letting the
              // user believe the missing series do not exist.
              comparison && comparison.truncated > 0 ? "text-warning" : "text-faint",
            )}
          >
            {comparison && comparison.truncated > 0
              ? `Se muestran 8 series; ${comparison.truncated} quedaron fuera.`
              : picked === 0
                ? "Selecciona series para comparar"
                : `${picked} ${picked === 1 ? "serie seleccionada" : "series seleccionadas"}`}
          </span>
        </>
      )}
    </Toolbar>
  );
}

/** Dashed "Agregar" pill; its list is the real accounts, centers, levels or periods. */
function AddSeries({
  dimLabel,
  options,
  picked,
  onToggle,
}: {
  dimLabel: string;
  options: SelectionEntryOption[];
  picked: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-chip-border px-3 py-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:border-faint hover:text-brand"
      >
        <Plus size={13} />
        Agregar
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 cursor-default"
          />
          <div
            role="menu"
            className="absolute left-0 top-[calc(100%+8px)] z-30 w-72 rounded-xl border border-border bg-surface p-2.5 shadow-[0_14px_36px_rgba(15,23,42,0.16)]"
          >
            <div className="px-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faintest">
              Series · {dimLabel}
            </div>
            {options.length === 0 ? (
              <EmptyState className="py-4">
                Sin series disponibles. Se cargan desde el Excel de Pérdidas y Ganancias.
              </EmptyState>
            ) : (
              <div className="-mx-1 max-h-72 overflow-y-auto">
                {options.map((option) => {
                  const on = picked.has(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={on}
                      onClick={() => onToggle(option.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors",
                        on ? "bg-brand-soft font-medium text-brand" : "text-ink hover:bg-canvas",
                      )}
                    >
                      <Check
                        size={13}
                        className={cn("shrink-0", on ? "opacity-100" : "opacity-0")}
                      />
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {option.hint && (
                        <span className="shrink-0 font-mono text-[10.5px] text-faint">
                          {option.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
