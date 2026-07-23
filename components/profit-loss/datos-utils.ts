/**
 * Pure derivations for the Datos table. Kept out of the components so the expensive
 * work (applying edits, flattening the tree, sorting) can be wrapped in `useMemo` and
 * unit-reasoned in isolation.
 */
import { formatCurrency } from "@/lib/format";
import type { DatosRow, DatosSort } from "@/lib/profit-loss/datos-types";

/** A tree row, flattened for rendering, with the display flags a row needs. */
export interface FlatRow {
  row: DatosRow;
  hasChildren: boolean;
  isCollapsed: boolean;
}

/** Row total = sum of its month cells (nulls treated as 0). */
export function rowTotal(row: DatosRow): number {
  return row.cells.reduce((acc, cell) => acc + (cell.value ?? 0), 0);
}

/** Cell/total display: app-wide currency, or an en-dash for empty/zero. */
export function formatAmount(value: number | null): string {
  if (value === null || value === 0) {
    return "–";
  }
  return formatCurrency(value);
}

function sortValue(row: DatosRow, sort: DatosSort): number | string {
  if (sort.key === "name") {
    return row.name;
  }
  if (sort.key === "total") {
    return rowTotal(row);
  }
  return row.cells[sort.key.col]?.value ?? 0;
}

function compareRows(a: DatosRow, b: DatosRow, sort: DatosSort): number {
  const av = sortValue(a, sort);
  const bv = sortValue(b, sort);
  const raw =
    typeof av === "string" && typeof bv === "string"
      ? av.localeCompare(bv)
      : Number(av) - Number(bv);
  return sort.dir === "asc" ? raw : -raw;
}

/**
 * Depth-first flatten, honoring collapsed nodes and the active sort. Sorting reorders
 * siblings within each parent (never across levels). Result rows are pinned to the end
 * regardless of sort so "Utilidad o Pérdida" always closes the grid.
 */
export function flattenSorted(
  rows: DatosRow[],
  collapsed: Set<string>,
  sort: DatosSort | null,
): FlatRow[] {
  const out: FlatRow[] = [];
  const normal = rows.filter((row) => !row.isResult);
  const results = rows.filter((row) => row.isResult);

  const walk = (list: DatosRow[]) => {
    const ordered = sort ? [...list].sort((a, b) => compareRows(a, b, sort)) : list;
    for (const row of ordered) {
      const hasChildren = Boolean(row.children?.length);
      const isCollapsed = collapsed.has(row.code);
      out.push({ row, hasChildren, isCollapsed });
      if (hasChildren && !isCollapsed && row.children) {
        walk(row.children);
      }
    }
  };

  walk(normal);
  for (const row of results) {
    out.push({ row, hasChildren: false, isCollapsed: false });
  }
  return out;
}
