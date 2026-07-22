"use client";

import { useCallback, useMemo, useState } from "react";
import { CellEditor, type EditorAnchor } from "./cell-editor";
import { CostCenterTabs } from "./cost-center-tabs";
import { DatosTable } from "./datos-table";
import {
  cellKey,
  type CostCenter,
  type DatosCellEdit,
  type DatosGrid,
  type DatosRow,
  type DatosSort,
  type DatosSortKey,
} from "./datos-types";
import { MONTHS_SHORT_ES } from "@/lib/date";
import { applyEdits, flattenSorted } from "./datos-utils";
import { MOCK_COST_CENTERS } from "./datos.fixtures";

interface EditingState extends EditorAnchor {
  code: string;
  col: number;
  /** Movement accounts edit their value; parents/result comment only. */
  valueEditable: boolean;
}

/**
 * The Datos tab body: cost-center tabs + the editable Estado de Resultados grid.
 *
 * Data is prop-driven so the Excel loader (built later) just supplies `grids`. With no
 * `grids` prop the view renders empty grids — one per cost center — so today's app shows
 * the empty state under the tab strip. `costCenters` defaults to a mock list so the
 * strip is visible now (see the FUTURE WORK note in `cost-center-tabs.tsx`).
 */
export function DatosView({
  grids,
  costCenters = MOCK_COST_CENTERS,
}: {
  grids?: DatosGrid[];
  costCenters?: CostCenter[];
}) {
  const resolvedGrids = useMemo(() => grids ?? emptyGridsFor(costCenters), [grids, costCenters]);

  const [activeCenter, setActiveCenter] = useState(() => resolvedGrids[0]?.id ?? "default");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<DatosSort | null>(null);
  const [edits, setEdits] = useState<Map<string, DatosCellEdit>>(() => new Map());
  const [editing, setEditing] = useState<EditingState | null>(null);

  const activeGrid = useMemo(
    () => resolvedGrids.find((grid) => grid.id === activeCenter) ?? resolvedGrids[0],
    [resolvedGrids, activeCenter],
  );

  const effectiveRows = useMemo(() => applyEdits(activeGrid.rows, edits), [activeGrid.rows, edits]);
  const visibleRows = useMemo(
    () => flattenSorted(effectiveRows, collapsed, sort),
    [effectiveRows, collapsed, sort],
  );

  const onToggle = useCallback((code: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  const onSort = useCallback((key: DatosSortKey) => {
    setSort((prev) => nextSort(prev, key));
  }, []);

  const onEditCell = useCallback(
    (code: string, col: number, anchor: EditorAnchor, valueEditable: boolean) => {
      setEditing({ code, col, valueEditable, ...anchor });
    },
    [],
  );

  const onSaveEdit = useCallback((value: number | null, comment: string) => {
    setEditing((current) => {
      if (!current) {
        return null;
      }
      setEdits((prev) => {
        const next = new Map(prev);
        // Only movement accounts persist a value; for parents we leave it untouched.
        next.set(cellKey(current.code, current.col), {
          value: current.valueEditable ? value : undefined,
          comment: comment || undefined,
        });
        return next;
      });
      return null;
    });
  }, []);

  const editingCell = editing ? findCell(effectiveRows, editing.code) : null;

  return (
    <div className="px-7 py-5">
      <CostCenterTabs centers={costCenters} activeId={activeCenter} onSelect={setActiveCenter} />

      <DatosTable
        grid={{ ...activeGrid, rows: effectiveRows }}
        rows={visibleRows}
        sort={sort}
        onSort={onSort}
        onToggle={onToggle}
        onEditCell={onEditCell}
      />

      {editing && editingCell && (
        <CellEditor
          anchor={editing}
          title={editingCell.name}
          subtitle={`${activeGrid.months[editing.col] ?? MONTHS_SHORT_ES[editing.col]} · ${activeGrid.title}`}
          valueEditable={editing.valueEditable}
          initialValue={editingCell.cells[editing.col]?.value ?? null}
          initialComment={editingCell.cells[editing.col]?.comment ?? ""}
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
function findCell(rows: DatosRow[], code: string): DatosRow | null {
  for (const row of rows) {
    if (row.code === code) {
      return row;
    }
    if (row.children) {
      const found = findCell(row.children, code);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/** One empty grid per cost center (or a single default) so the empty state shows per tab. */
function emptyGridsFor(centers: CostCenter[]): DatosGrid[] {
  const months = [...MONTHS_SHORT_ES];
  if (centers.length === 0) {
    return [{ id: "default", title: "Estado de Resultados", months, rows: [] }];
  }
  return centers.map((center) => ({
    id: center.id,
    title: center.name,
    dotColor: center.color,
    months,
    rows: [],
  }));
}
