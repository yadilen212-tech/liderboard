"use client";

import { useCallback, useMemo, useState } from "react";
import { MONTHS_SHORT_ES } from "@/lib/date";
import type { DatosGrid, DatosRow, DatosSort, DatosSortKey } from "@/lib/profit-loss/datos-types";
import { toDatosGrid } from "@/lib/profit-loss/derive";
import { CellEditor, type EditorAnchor } from "./cell-editor";
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
  const { dataset, edits, frequency, saveEdit, uploadError, clearUploadError } = usePygData();

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<DatosSort | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [warningsDismissed, setWarningsDismissed] = useState(false);

  const grid = useMemo(
    () => (dataset ? toDatosGrid(dataset, edits, frequency) : EMPTY_GRID),
    [dataset, edits, frequency],
  );
  const visibleRows = useMemo(
    () => flattenSorted(grid.rows, collapsed, sort),
    [grid.rows, collapsed, sort],
  );

  // Value edits and comments only make sense against a concrete month.
  const editable = Boolean(dataset) && frequency === "mensual";
  const showTotal = frequency !== "anual";

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

  const onSaveEdit = useCallback(
    (value: number | null, comment: string) => {
      setEditing((current) => {
        if (current) {
          void saveEdit(
            current.code,
            current.col,
            current.valueEditable ? value : undefined,
            comment,
          );
        }
        return null;
      });
    },
    [saveEdit],
  );

  const editingRow = editing ? findRow(grid.rows, editing.code) : null;

  return (
    <div className="px-7 py-5">
      {uploadError && (
        <NoticeBanner tone="error" onDismiss={clearUploadError}>
          {uploadError}
        </NoticeBanner>
      )}

      {dataset && dataset.warnings.length > 0 && !warningsDismissed && (
        <NoticeBanner tone="warning" onDismiss={() => setWarningsDismissed(true)}>
          El archivo tiene {dataset.warnings.length}{" "}
          {dataset.warnings.length === 1 ? "descuadre" : "descuadres"} de sumatoria; se muestran los
          valores recalculados.
        </NoticeBanner>
      )}

      <DatosTable
        grid={grid}
        rows={visibleRows}
        sort={sort}
        editable={editable}
        showTotal={showTotal}
        onSort={onSort}
        onToggle={onToggle}
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
