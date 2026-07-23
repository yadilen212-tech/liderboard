"use client";

import { ChevronDown, GitCompare, Layers, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Dropdown, DropdownPanel, DropdownTrigger } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Toolbar, ToolbarLabel } from "@/components/ui/toolbar";
import { cn } from "@/lib/cn";
import type { ModuleTabId } from "@/lib/modules";
import { deepestLevel, matchExpandLevel } from "@/lib/profit-loss/filter";
import type { AccountRow, Frequency } from "@/lib/profit-loss/types";
import { AccountFilter } from "./account-filter";
import { CompareBar } from "./compare-bar";
import { usePygData } from "./pyg-data-provider";

const GRANULARITIES: { value: Frequency; label: string }[] = [
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

/** PyG filter section rendered under the tabs. Account + level filters and the frequency
 * are wired to the shared PyG dataset; only "Comparar" is still visual. */
export function PygToolbar({ activeTab }: { activeTab: ModuleTabId }) {
  const {
    frequency,
    allowed,
    setFrequency,
    deepestLevel: deepest,
    accountOptions,
    selectedAccounts,
    toggleAccount,
    clearAccounts,
    dataset,
    collapsed,
    setExpandLevel,
  } = usePygData();
  const granularityOptions = GRANULARITIES.map((option) => ({
    ...option,
    disabled: !allowed.includes(option.value),
  }));
  const [compareOpen, setCompareOpen] = useState(false);
  const canCompare = activeTab === "graficos" || activeTab === "analisis";

  return (
    <div className="shrink-0 border-b border-border bg-surface">
      <Toolbar>
        <ToolbarLabel icon={<SlidersHorizontal size={15} />}>Filtros</ToolbarLabel>

        <AccountFilter
          accounts={accountOptions}
          selected={selectedAccounts}
          onToggle={toggleAccount}
          onClear={clearAccounts}
        />
        <NivelFilter
          deepest={deepest}
          accounts={dataset?.accounts}
          collapsed={collapsed}
          onSelect={setExpandLevel}
        />

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
            ariaLabel="Frecuencia"
            options={granularityOptions}
            value={frequency}
            onChange={setFrequency}
          />
        </div>
      </Toolbar>

      {canCompare && compareOpen && <CompareBar />}
    </div>
  );
}

/**
 * "Nivel" — the single depth control for the Datos tree. Picking "Nivel N" collapses the
 * accordion down to N (rows keep their chevrons for ad-hoc drill-down); "Todos los niveles"
 * fully expands it. Options run 1..(deepest-1) off the deepest movement account across ALL
 * files in the workspace; "Todos" absorbs the fully-expanded (deepest) state — a redundant
 * "Nivel deepest" (leaves have nothing to collapse). With no data (or a flat file) the panel
 * shows an empty state instead of levels.
 */
function NivelFilter({
  deepest,
  accounts,
  collapsed,
  onSelect,
}: {
  deepest: number;
  accounts: AccountRow[] | undefined;
  collapsed: ReadonlySet<string>;
  onSelect: (level: number | "all") => void;
}) {
  const levels = deepest >= 2 ? Array.from({ length: deepest - 1 }, (_, i) => i + 1) : [];
  // Which level the current collapse state represents for THIS view: an empty set is always
  // fully expanded ("Todos"), regardless of how the active view's depth compares to the
  // workspace-deepest; otherwise match against the active view's own tree, or `null` (custom)
  // when the user has toggled rows by hand into a state no preset produces.
  const active: number | "all" | null =
    collapsed.size === 0
      ? "all"
      : accounts
        ? matchExpandLevel(accounts, collapsed, deepestLevel(accounts))
        : null;

  return (
    <Dropdown>
      <DropdownTrigger icon={<Layers size={15} />} active={typeof active === "number"}>
        {typeof active === "number" ? `Nivel ${active}` : "Nivel"}
      </DropdownTrigger>
      <DropdownPanel width={216}>
        {levels.length === 0 ? (
          <EmptyState icon={<Layers size={22} />} className="py-4">
            {deepest === 0
              ? "Carga un Excel de Pérdidas y Ganancias para filtrar por nivel."
              : "El archivo cargado no tiene subniveles de cuenta."}
          </EmptyState>
        ) : (
          <>
            <div className="px-1.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faintest">
              Mostrar hasta nivel
            </div>
            <div className="-mx-1">
              <NivelOption
                label="Todos los niveles"
                active={active === "all"}
                onClick={() => onSelect("all")}
              />
              {levels.map((level) => (
                <NivelOption
                  key={level}
                  label={`Nivel ${level}`}
                  active={active === level}
                  onClick={() => onSelect(level)}
                />
              ))}
            </div>
          </>
        )}
      </DropdownPanel>
    </Dropdown>
  );
}

function NivelOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors",
        active ? "bg-brand-soft font-medium text-brand" : "text-ink hover:bg-canvas",
      )}
    >
      {label}
    </button>
  );
}
