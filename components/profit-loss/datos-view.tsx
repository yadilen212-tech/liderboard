"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MONTHS_SHORT_ES } from "@/lib/date";
import type { DatosGrid, DatosRow, DatosSort, DatosSortKey } from "@/lib/profit-loss/datos-types";
import { toDatosGrid } from "@/lib/profit-loss/derive";
import { filterDatosRows } from "@/lib/profit-loss/filter";
import { CellEditor, type EditorAnchor } from "./cell-editor";
import { CostCenterTabs } from "./cost-center-tabs";
import { flattenSorted } from "./datos-utils";
import { NoticeBanner } from "./notice-banner";
import { DatosTable } from "./datos-table";
import { usePygData } from "./pyg-data-provider";

interface EditingState extends EditorAnchor {
  code: string;
  col: number;
  valueEditable: boolean;
}

const EMPTY_GRID: DatosGrid = {
  id: "default",
  title: "Estado de Resultados",
  months: [...MONTHS_SHORT_ES],
  rows: [],
};

/**
 * The Datos tab body: the editable Estado de Resultados grid, fed by the uploaded
 * Excel via PygDataProvider. Cell editing/commenting is MONTHLY-VIEW ONLY (see
 * README, "Edición y frecuencias") — aggregated cells are read-only sums.
 *
 * FUTURE WORK (cost centers): when consolidated/multi-center support lands, render
 * <CostCenterTabs> above the table gated on the dataset actually carrying centers.
 */
export function DatosView() {
  const {
    dataset,
    edits,
    frequency,
    allowed,
    saveEdit,
    mode,
    views,
    activeCenterId,
    setActiveCenter,
    warnings,
    selectedAccounts,
    maxLevel,
    collapsed,
    toggleCollapsed,
  } = usePygData();

  const [sort, setSort] = useState<DatosSort | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [warningsDismissed, setWarningsDismissed] = useState(false);

  // A newly loaded dataset can be coarser than the current view (its base floors the
  // options), but the provider resets `frequency` to the base one render later. Until it
  // does, fall back to the base so we never ask toDatosGrid to disaggregate (it throws).
  const effectiveFrequency = allowed.includes(frequency)
    ? frequency
    : (dataset?.baseFrequency ?? frequency);

  const grid = useMemo(
    () => (dataset ? toDatosGrid(dataset, edits, effectiveFrequency) : EMPTY_GRID),
    [dataset, edits, effectiveFrequency],
  );
  // Account focus + level cap decide which rows show; amounts (and Utilidad) are untouched.
  const filteredRows = useMemo(
    () => filterDatosRows(grid.rows, { selected: selectedAccounts, maxLevel }),
    [grid.rows, selectedAccounts, maxLevel],
  );
  const visibleRows = useMemo(
    () => flattenSorted(filteredRows, collapsed, sort),
    [filteredRows, collapsed, sort],
  );

  // A newly loaded workspace should surface its own warnings even if the previous banner
  // was dismissed.
  useEffect(() => {
    setWarningsDismissed(false);
  }, [warnings]);

  // Aggregating to fewer columns (e.g. Mensual → Trimestral) can strand a month-column
  // sort on a column that no longer exists; clear it so the grid isn't "sorted" by nothing.
  useEffect(() => {
    setSort((prev) =>
      prev && typeof prev.key === "object" && prev.key.col >= grid.months.length ? null : prev,
    );
  }, [grid.months.length]);

  // Value edits/comments only make sense on an editable center in the concrete monthly view.
  const activeView = views.find((v) => v.id === activeCenterId);
  const editable = Boolean(activeView?.editable) && effectiveFrequency === "mensual";
  const showTotal = effectiveFrequency !== "anual";

  const onSort = useCallback((key: DatosSortKey) => {
    setSort((prev) => nextSort(prev, key));
  }, []);

  const onEditCell = useCallback(
    (code: string, col: number, anchor: EditorAnchor, valueEditable: boolean) => {
      setEditing({ code, col, valueEditable, ...anchor });
    },
    [],
  );

  const onSaveEdit = useCallback(
    (value: number | null, comment: string) => {
      // The persist call is a side effect, so it must live OUTSIDE the state updater:
      // React StrictMode double-invokes updaters, which would fire two concurrent writes
      // for the same cell and collide on the unique [datasetId+code+monthIndex] index.
      if (editing) {
        void saveEdit(
          editing.code,
          editing.col,
          editing.valueEditable ? value : undefined,
          comment,
        );
      }
      setEditing(null);
    },
    [editing, saveEdit],
  );

  const editingRow = editing ? findRow(grid.rows, editing.code) : null;

  return (
    <div className="px-7 py-5">
      {mode === "multi" && (
        <CostCenterTabs views={views} activeId={activeCenterId} onSelect={setActiveCenter} />
      )}

      {warnings.length > 0 && !warningsDismissed && (
        <NoticeBanner tone="warning" onDismiss={() => setWarningsDismissed(true)}>
          El espacio de trabajo tiene {warnings.length} {warnings.length === 1 ? "aviso" : "avisos"}{" "}
          de cuadre; se muestran los valores tal cual.
        </NoticeBanner>
      )}

      <DatosTable
        grid={grid}
        rows={visibleRows}
        sort={sort}
        editable={editable}
        showTotal={showTotal}
        onSort={onSort}
        onToggle={toggleCollapsed}
        onEditCell={onEditCell}
      />

      {editing && editingRow && (
        <CellEditor
          anchor={editing}
          title={editingRow.name}
          subtitle={`${grid.months[editing.col] ?? ""} · ${grid.title}`}
          valueEditable={editing.valueEditable}
          initialValue={editingRow.cells[editing.col]?.value ?? null}
          initialComment={editingRow.cells[editing.col]?.comment ?? ""}
          onSave={onSaveEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** Cycle a column through asc → desc → unsorted; switching columns starts at asc. */
function nextSort(prev: DatosSort | null, key: DatosSortKey): DatosSort | null {
  const same =
    prev &&
    (typeof prev.key === "object" && typeof key === "object"
      ? prev.key.col === key.col
      : prev.key === key);
  if (!same) {
    return { key, dir: "asc" };
  }
  if (prev?.dir === "asc") {
    return { key, dir: "desc" };
  }
  return null;
}

/** Depth-first lookup of a row by account code. */
function findRow(rows: DatosRow[], code: string): DatosRow | null {
  for (const row of rows) {
    if (row.code === code) {
      return row;
    }
    if (row.children) {
      const found = findRow(row.children, code);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
