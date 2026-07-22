"use client";

import { Building2, ChevronDown, GitCompare, Layers, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Dropdown, DropdownPanel, DropdownTrigger } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Toolbar, ToolbarLabel } from "@/components/ui/toolbar";
import { cn } from "@/lib/cn";
import type { ModuleTabId } from "@/lib/modules";
import { AccountFilter } from "./account-filter";
import { CompareBar } from "./compare-bar";
import { PeriodFilter } from "./period-filter";

type Granularity = "mes" | "trim" | "sem";

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "mes", label: "Mensual" },
  { value: "trim", label: "Trimestral" },
  { value: "sem", label: "Semestral" },
];

/** PyG filter section rendered under the tabs. Visual only. */
export function PygToolbar({ activeTab }: { activeTab: ModuleTabId }) {
  const [granularity, setGranularity] = useState<Granularity>("mes");
  const [compareOpen, setCompareOpen] = useState(false);
  const canCompare = activeTab === "graficos" || activeTab === "analisis";

  return (
    <div className="shrink-0 border-b border-border bg-surface">
      <Toolbar>
        <ToolbarLabel icon={<SlidersHorizontal size={15} />}>Filtros</ToolbarLabel>

        <AccountFilter />
        <NivelFilter />
        <CostCenterFilter />

        {canCompare && (
          <button
            type="button"
            aria-expanded={compareOpen}
            onClick={() => setCompareOpen((value) => !value)}
            className={cn(
              "inline-flex h-[34px] items-center gap-2 rounded-[9px] border px-3 text-[12.5px] font-semibold transition-colors",
              compareOpen
                ? "border-brand bg-brand-soft text-brand"
                : "border-border bg-surface text-muted hover:bg-canvas",
            )}
          >
            <GitCompare size={15} />
            Comparar
            <ChevronDown
              size={14}
              className={cn("transition-transform", compareOpen && "rotate-180")}
            />
          </button>
        )}

        <div className="ml-auto flex items-center gap-2.5">
          <ToolbarLabel>Ver por</ToolbarLabel>
          <SegmentedControl
            variant="track"
            className="bg-border-faint"
            ariaLabel="Granularidad"
            options={GRANULARITIES}
            value={granularity}
            onChange={setGranularity}
          />
          <PeriodFilter />
        </div>
      </Toolbar>

      {canCompare && compareOpen && <CompareBar />}
    </div>
  );
}

const NIVEL_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos los niveles" },
  { value: "1", label: "Nivel 1" },
  { value: "2", label: "Nivel 2" },
  { value: "3", label: "Nivel 3" },
  { value: "4", label: "Nivel 4" },
];

/** "Mostrar hasta nivel" — the depth of the account tree to show. Static levels. */
function NivelFilter() {
  const [level, setLevel] = useState("all");

  return (
    <Dropdown>
      <DropdownTrigger icon={<Layers size={15} />} active={level !== "all"}>
        {level === "all" ? "Nivel" : `Nivel ${level}`}
      </DropdownTrigger>
      <DropdownPanel width={216}>
        <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faintest">
          Mostrar hasta nivel
        </div>
        <div className="-mx-1">
          {NIVEL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setLevel(option.value)}
              className={cn(
                "flex w-full items-center rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors",
                level === option.value
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
  );
}

/** "Centro de costos" — populated from the Excel; empty state until one loads. */
function CostCenterFilter() {
  return (
    <Dropdown>
      <DropdownTrigger icon={<Building2 size={15} />}>Centro de costos</DropdownTrigger>
      <DropdownPanel width={262}>
        <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faintest">
          Centro de costos · Sucursal
        </div>
        <EmptyState className="py-4">Los datos cargados no incluyen centros de costo.</EmptyState>
      </DropdownPanel>
    </Dropdown>
  );
}
