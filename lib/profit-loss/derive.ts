/**
 * Pure derivations over parsed PyG data: account tree, parent rollups, the Utilidad
 * result, and edit overlays. Parents are ALWAYS recomputed from movement (leaf)
 * accounts — the file's parent values are validation input, never display truth.
 */
import type { AccountRow, CellEdit } from "./types";

export interface AccountNode {
  code: string;
  name: string;
  values: number[];
  /** Code segment count: "4.1.1" → 3. Drives the UI indent. */
  level: number;
  children: AccountNode[];
}

/**
 * Links accounts by dot-prefix (parent of "4.1.1" is "4.1"). An orphan whose immediate
 * parent is missing attaches to its nearest existing ancestor; duplicates keep the
 * first occurrence. Both cases produce a Spanish warning.
 */
export function buildAccountTree(accounts: AccountRow[]): {
  roots: AccountNode[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const byCode = new Map<string, AccountNode>();
  const roots: AccountNode[] = [];

  for (const account of accounts) {
    if (byCode.has(account.code)) {
      warnings.push(`Cuenta duplicada en el archivo: ${account.code}; se conserva la primera.`);
      continue;
    }
    const node: AccountNode = {
      code: account.code,
      name: account.name,
      values: [...account.values],
      level: account.code.split(".").length,
      children: [],
    };
    byCode.set(account.code, node);

    const ancestor = nearestAncestor(account.code, byCode);
    if (ancestor) {
      if (ancestor.code !== parentCode(account.code)) {
        warnings.push(
          `La cuenta ${account.code} no tiene padre directo en el archivo; se anida bajo ${ancestor.code}.`,
        );
      }
      ancestor.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return { roots, warnings };
}

function parentCode(code: string): string | null {
  const cut = code.lastIndexOf(".");
  return cut === -1 ? null : code.slice(0, cut);
}

function nearestAncestor(code: string, byCode: Map<string, AccountNode>): AccountNode | null {
  for (let prefix = parentCode(code); prefix !== null; prefix = parentCode(prefix)) {
    const found = byCode.get(prefix);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Overlays value edits onto LEAF nodes only (parents derive downstream), cloning just
 * the paths that change so memoized rows keep identity. `null` clears a cell to 0.
 */
export function applyLeafEdits(roots: AccountNode[], edits: CellEdit[]): AccountNode[] {
  const valueEdits = new Map<string, CellEdit[]>();
  for (const item of edits) {
    if (item.value === undefined) {
      continue;
    }
    const list = valueEdits.get(item.code) ?? [];
    list.push(item);
    valueEdits.set(item.code, list);
  }
  if (valueEdits.size === 0) {
    return roots;
  }
  return roots.map((node) => applyToNode(node, valueEdits));
}

function applyToNode(node: AccountNode, valueEdits: Map<string, CellEdit[]>): AccountNode {
  const children = node.children.map((child) => applyToNode(child, valueEdits));
  const childrenChanged = children.some((child, i) => child !== node.children[i]);

  const isLeaf = node.children.length === 0;
  const own = isLeaf ? valueEdits.get(node.code) : undefined;
  if (!own?.length && !childrenChanged) {
    return node;
  }

  let values = node.values;
  if (own?.length) {
    values = [...node.values];
    for (const item of own) {
      if (item.monthIndex >= 0 && item.monthIndex < values.length) {
        values[item.monthIndex] = item.value ?? 0;
      }
    }
  }
  return { ...node, values, children };
}

/** Post-order rollup: every parent's values become the column-wise sum of its children. */
export function computeRollups(roots: AccountNode[]): AccountNode[] {
  return roots.map(rollupNode);
}

function rollupNode(node: AccountNode): AccountNode {
  if (node.children.length === 0) {
    return node;
  }
  const children = node.children.map(rollupNode);
  const values = node.values.map((_, col) =>
    children.reduce((sum, child) => sum + (child.values[col] ?? 0), 0),
  );
  return { ...node, values, children };
}

/**
 * Utilidad o Pérdida = Σ roots starting "4" − Σ roots starting "5". Expenses are
 * stored positive in the source system, hence the subtraction (never a sign flip).
 * Call AFTER computeRollups so root values are trustworthy.
 */
export function computeResult(roots: AccountNode[]): { values: number[]; warnings: string[] } {
  const warnings: string[] = [];
  const width = roots[0]?.values.length ?? 0;
  const values = Array.from({ length: width }, () => 0);

  for (const root of roots) {
    const sign = root.code.startsWith("4") ? 1 : root.code.startsWith("5") ? -1 : 0;
    if (sign === 0) {
      warnings.push(
        `La cuenta raíz ${root.code} no es de ingresos (4) ni costos/gastos (5); se excluye de Utilidad o Pérdida.`,
      );
      continue;
    }
    for (let col = 0; col < width; col++) {
      values[col] += sign * (root.values[col] ?? 0);
    }
  }
  return { values, warnings };
}
