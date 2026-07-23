/**
 * Pure derivations over parsed PyG data: account tree, parent rollups, the Utilidad
 * result, and edit overlays. Parents are ALWAYS recomputed from movement (leaf)
 * accounts — the file's parent values are validation input, never display truth.
 */
import { MONTHS_SHORT_ES } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import type { DatosCell, DatosGrid, DatosRow } from "./datos-types";
import type { AccountRow, CellEdit, Frequency, PygDataset } from "./types";

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

/** Coarseness order. A file's base frequency floors the UI options (aggregate up only). */
export const FREQUENCY_ORDER: readonly Frequency[] = [
  "mensual",
  "trimestral",
  "semestral",
  "anual",
];

/** Months each period spans, in a 12-month year. */
const MONTHS_PER_PERIOD: Record<Frequency, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

const PERIOD_LABELS: Record<Frequency, readonly string[]> = {
  mensual: MONTHS_SHORT_ES,
  trimestral: ["T1", "T2", "T3", "T4"],
  semestral: ["S1", "S2"],
  anual: ["Total"],
};

export function allowedFrequencies(base: Frequency): Frequency[] {
  return FREQUENCY_ORDER.slice(FREQUENCY_ORDER.indexOf(base));
}

export function periodLabels(target: Frequency): readonly string[] {
  return PERIOD_LABELS[target];
}

/**
 * Period SUMS — a P&L is a flow statement, so quarters/semesters/years add their
 * months (never average). A non-monthly base can only render itself.
 */
export function aggregate(values: number[], base: Frequency, target: Frequency): number[] {
  if (base === target) {
    return values;
  }
  if (base !== "mensual") {
    throw new Error(`No se puede desagregar de ${base} a ${target}.`);
  }
  const span = MONTHS_PER_PERIOD[target];
  const periods = 12 / span;
  return Array.from({ length: periods }, (_, p) =>
    values.slice(p * span, (p + 1) * span).reduce((sum, v) => sum + v, 0),
  );
}

/**
 * The full pipeline the Datos view renders: tree → leaf edits → rollups → aggregate →
 * grid. Comments stay keyed by base month; an aggregated cell inherits (joined) the
 * comments of the months it covers, as a read-only indicator.
 */
export function toDatosGrid(
  dataset: PygDataset,
  edits: CellEdit[],
  frequency: Frequency,
): DatosGrid {
  const { roots } = buildAccountTree(dataset.accounts);
  const rolled = computeRollups(applyLeafEdits(roots, edits));
  const result = computeResult(rolled);

  const comments = new Map<string, Map<number, string>>();
  for (const item of edits) {
    if (!item.comment) {
      continue;
    }
    const byMonth = comments.get(item.code) ?? new Map<number, string>();
    byMonth.set(item.monthIndex, item.comment);
    comments.set(item.code, byMonth);
  }

  const base = dataset.baseFrequency;
  const rows: DatosRow[] = rolled.map((node) => toDatosRow(node, base, frequency, comments));
  const resultValues = aggregate(result.values, base, frequency);
  rows.push({
    code: "",
    name: "Utilidad o Pérdida",
    level: 1,
    isResult: true,
    cells: resultValues.map((value) => ({ value })),
  });

  const total = result.values.reduce((sum, v) => sum + v, 0);
  const positive = total >= 0;
  return {
    id: "default",
    title: "Estado de Resultados",
    utilidad: {
      label: `${positive ? "Utilidad" : "Pérdida"} ${formatCurrency(total)}`,
      positive,
    },
    months: [...periodLabels(base === "anual" ? "anual" : frequency)],
    rows,
  };
}

function toDatosRow(
  node: AccountNode,
  base: Frequency,
  frequency: Frequency,
  comments: Map<string, Map<number, string>>,
): DatosRow {
  const values = aggregate(node.values, base, frequency);
  const byMonth = comments.get(node.code);
  const span = base === "mensual" ? MONTHS_PER_PERIOD[frequency] : 1;

  const cells: DatosCell[] = values.map((value, period) => {
    const joined = byMonth ? joinComments(byMonth, period, span) : undefined;
    return joined ? { value, comment: joined } : { value };
  });

  return {
    code: node.code,
    name: node.name,
    level: node.level,
    cells,
    ...(node.children.length > 0
      ? { children: node.children.map((child) => toDatosRow(child, base, frequency, comments)) }
      : {}),
  };
}

/** Joins the comments of every base month a period covers ("" → undefined). */
function joinComments(
  byMonth: Map<number, string>,
  period: number,
  span: number,
): string | undefined {
  const parts: string[] = [];
  for (let m = period * span; m < (period + 1) * span; m++) {
    const comment = byMonth.get(m);
    if (comment) {
      parts.push(comment);
    }
  }
  return parts.length > 0 ? parts.join("\n") : undefined;
}
