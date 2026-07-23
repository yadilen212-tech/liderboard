/**
 * View filters for the PyG › Datos table, layered on top of the derived grid so the
 * amounts (and the global Utilidad row) are never recomputed — filters only decide which
 * rows are visible. Kept pure and out of the components so Vitest can reason about them
 * and `useMemo` can wrap the work. Unchanged subtrees keep their node reference, so the
 * memoized rows don't all re-render when a filter changes.
 */
import type { DatosRow } from "./datos-types";
import { buildAccountTree, type AccountNode } from "./derive";
import type { AccountRow } from "./types";

/** One selectable account in the "Cuenta contable" filter. */
export interface AccountOption {
  code: string;
  name: string;
}

/** Depth of the deepest movement (leaf) account; the deepest code is always a leaf. */
export function deepestLevel(accounts: AccountRow[]): number {
  return accounts.reduce((max, account) => Math.max(max, account.code.split(".").length), 0);
}

/** Every account (parents included) as a filter option, in file order. */
export function accountOptions(accounts: AccountRow[]): AccountOption[] {
  return accounts.map((account) => ({ code: account.code, name: account.name }));
}

/**
 * "Enfocar con contexto": keep the selected accounts with their whole subtree and their
 * ancestor rows as context, pruning unselected sibling branches. An empty selection is a
 * no-op (same reference). `isResult` rows are always kept (the global Utilidad).
 */
export function focusAccounts(rows: DatosRow[], selected: ReadonlySet<string>): DatosRow[] {
  if (selected.size === 0) {
    return rows;
  }
  const out: DatosRow[] = [];
  for (const row of rows) {
    if (row.isResult) {
      out.push(row);
      continue;
    }
    const kept = keepFocused(row, selected, false);
    if (kept) {
      out.push(kept);
    }
  }
  return out;
}

function keepFocused(
  node: DatosRow,
  selected: ReadonlySet<string>,
  ancestorSelected: boolean,
): DatosRow | null {
  if (ancestorSelected || selected.has(node.code)) {
    return node; // whole subtree kept, reference preserved
  }
  if (!node.children?.length) {
    return null;
  }
  const keptChildren: DatosRow[] = [];
  for (const child of node.children) {
    const kept = keepFocused(child, selected, false);
    if (kept) {
      keptChildren.push(kept);
    }
  }
  return keptChildren.length > 0 ? { ...node, children: keptChildren } : null;
}

/**
 * "Mostrar hasta nivel N": strip children from nodes at `level >= maxLevel` so nothing
 * deeper shows. Their amounts already rolled up into the capped node. `null` is a no-op.
 */
export function capToLevel(rows: DatosRow[], maxLevel: number | null): DatosRow[] {
  if (maxLevel === null) {
    return rows;
  }
  return rows.map((row) => capNode(row, maxLevel));
}

function capNode(node: DatosRow, maxLevel: number): DatosRow {
  if (!node.children?.length) {
    return node;
  }
  if (node.level >= maxLevel) {
    const stripped: DatosRow = { ...node };
    delete stripped.children;
    return stripped;
  }
  return { ...node, children: node.children.map((child) => capNode(child, maxLevel)) };
}

/** Account focus then depth cap — the order the Datos view applies them. */
export function filterDatosRows(
  rows: DatosRow[],
  { selected, maxLevel }: { selected: ReadonlySet<string>; maxLevel: number | null },
): DatosRow[] {
  return capToLevel(focusAccounts(rows, selected), maxLevel);
}

/**
 * Codes to collapse so the tree shows expanded down to `level`: every parent node at
 * `level >= level` (its children hide). "Todo"/fully-expanded is an empty set (handled by
 * the caller), never this function.
 */
export function collapsedForLevel(accounts: AccountRow[], level: number): Set<string> {
  const { roots } = buildAccountTree(accounts);
  const out = new Set<string>();
  const walk = (nodes: AccountNode[]) => {
    for (const node of nodes) {
      if (node.children.length > 0) {
        if (node.level >= level) {
          out.add(node.code);
        }
        walk(node.children);
      }
    }
  };
  walk(roots);
  return out;
}

/**
 * Which Expandir level (1..deepest) is active for the current collapse state, or null if
 * custom. Level `deepest` is the fully-expanded state (its collapse set is empty, since the
 * deepest accounts are leaves with nothing to collapse).
 */
export function matchExpandLevel(
  accounts: AccountRow[],
  collapsed: ReadonlySet<string>,
  deepest: number,
): number | null {
  for (let level = 1; level <= deepest; level++) {
    if (setsEqual(collapsed, collapsedForLevel(accounts, level))) {
      return level;
    }
  }
  return null;
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }
  return true;
}
