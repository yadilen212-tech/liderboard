"use client";

import { Layers2, Plus } from "lucide-react";
import { useState } from "react";
import { Dropdown, DropdownPanel, DropdownTrigger } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Toolbar, ToolbarLabel } from "@/components/ui/toolbar";
import { cn } from "@/lib/cn";

type Dim = "nada" | "cuentas" | "centros" | "periodos" | "niveles";

const DIMS: { value: Dim; label: string }[] = [
  { value: "nada", label: "Nada" },
  { value: "cuentas", label: "Cuentas" },
  { value: "centros", label: "Centros" },
  { value: "periodos", label: "Periodos" },
  { value: "niveles", label: "Niveles" },
];

const CROSS: { value: Dim; label: string }[] = [
  { value: "nada", label: "Ninguno" },
  { value: "cuentas", label: "Cuentas" },
  { value: "centros", label: "Centros" },
  { value: "periodos", label: "Periodos" },
  { value: "niveles", label: "Niveles" },
];

const labelOf = (dim: Dim) => DIMS.find((option) => option.value === dim)?.label ?? "Nada";

/**
 * "Comparar por" box shown under the filter row in Gráficos/Análisis. Picking a
 * dimension reveals the series controls; series values come from the Excel, so
 * they render an empty state for now.
 */
export function CompareBar() {
  const [dim, setDim] = useState<Dim>("nada");
  const [cross, setCross] = useState<Dim>("nada");
  const active = dim !== "nada";

  return (
    <Toolbar tone="sunken">
      <ToolbarLabel>Comparar por</ToolbarLabel>
      <SegmentedControl
        variant="track"
        className="bg-surface"
        ariaLabel="Comparar por dimensión"
        options={DIMS}
        value={dim}
        onChange={setDim}
      />

      {active && (
        <>
          <AddSeries dimLabel={labelOf(dim)} />

          <span className="h-[22px] w-px bg-chip-border" />

          <Dropdown>
            <DropdownTrigger icon={<Layers2 size={14} />} active={cross !== "nada"}>
              {cross === "nada" ? "Y también por" : labelOf(cross)}
            </DropdownTrigger>
            <DropdownPanel width={224}>
              <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faintest">
                Y también por (cruce)
              </div>
              <div className="-mx-1">
                {CROSS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCross(option.value)}
                    className={cn(
                      "flex w-full items-center rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors",
                      cross === option.value
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

          <span className="ml-auto text-[11.5px] font-medium text-faint">
            Selecciona series para comparar
          </span>
        </>
      )}
    </Toolbar>
  );
}

/** Dashed "Agregar" pill that opens a series picker; empty until Excel data loads. */
function AddSeries({ dimLabel }: { dimLabel: string }) {
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
            <EmptyState className="py-4">
              Sin series disponibles. Se cargan desde el Excel de Pérdidas y Ganancias.
            </EmptyState>
          </div>
        </>
      )}
    </div>
  );
}
