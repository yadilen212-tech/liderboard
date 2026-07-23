/**
 * Pure workspace builder: turns a set of staged parse results (monthly sucursal statements,
 * a center-less statement, and/or a consolidated file) into the datasets + meta the provider
 * persists. Grouping is by explicit user action (whatever was staged together) + company name;
 * NEVER by filename — the real exports prove filenames unreliable. Centers are identified by
 * their internal "Centro de Costo:" line.
 */
import type { ParsedConsolidated } from "./parse";
import type { AccountRow, ImportedComment, PygDataset, PygParseResult } from "./types";

/** Center dot palette (from the design's `_ccColorMap`). */
export const CENTER_PALETTE = ["#1e3a5f", "#0e7490", "#d97706", "#16a34a", "#7c3aed", "#dc2626"];
const SIN_CENTRO_COLOR = "#64748b";
const SUM_TOLERANCE = 0.011;

export function slugifyCenter(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type StagedParse =
  | { format: "statement"; result: PygParseResult }
  | { format: "consolidated"; consolidated: ParsedConsolidated };

export interface WorkspaceMeta {
  companyName: string;
  warnings: string[];
  activeCenterId: string;
}

export interface BuiltWorkspace {
  mode: "single" | "multi";
  datasets: PygDataset[];
  commentsByDataset: { datasetId: string; comments: ImportedComment[] }[];
  meta: WorkspaceMeta;
}

function annualTotals(accounts: AccountRow[]): Map<string, number> {
  return new Map(accounts.map((a) => [a.code, a.values.reduce((s, v) => s + v, 0)]));
}

export function buildWorkspace(staged: StagedParse[]): BuiltWorkspace {
  const warnings: string[] = [];
  const statements = staged.filter((s) => s.format === "statement") as Extract<
    StagedParse,
    { format: "statement" }
  >[];
  const consolidatedInput = staged.find((s) => s.format === "consolidated") as
    | Extract<StagedParse, { format: "consolidated" }>
    | undefined;

  const centerStatements = statements.filter((s) => s.result.dataset.costCenterName);
  const centerlessStatements = statements.filter((s) => !s.result.dataset.costCenterName);

  // Single mode: exactly one center-less statement, nothing else.
  if (centerStatements.length === 0 && !consolidatedInput && centerlessStatements.length >= 1) {
    const chosen = centerlessStatements[0];
    if (centerlessStatements.length > 1) {
      warnings.push("Se cargaron varios estados sin centro de costo; se conserva el primero.");
    }
    const dataset: PygDataset = { ...chosen.result.dataset, role: "single" };
    return {
      mode: "single",
      datasets: [dataset],
      commentsByDataset: [{ datasetId: dataset.id, comments: chosen.result.comments }],
      meta: { companyName: dataset.companyName, warnings, activeCenterId: dataset.id },
    };
  }

  if (centerlessStatements.length > 0) {
    warnings.push(
      "En modo por centros de costo se ignoraron los estados sin línea de centro de costo.",
    );
  }

  const datasets: PygDataset[] = [];
  const commentsByDataset: { datasetId: string; comments: ImportedComment[] }[] = [];
  const usedSlugs = new Map<string, number>(); // slug → index in datasets
  let companyName = "";

  const pushCenter = (dataset: PygDataset, comments: ImportedComment[], name: string): void => {
    const slug = slugifyCenter(name);
    const color = CENTER_PALETTE[usedSlugs.size % CENTER_PALETTE.length];
    const withRole: PygDataset = {
      ...dataset,
      role: "center",
      centerId: slug,
      centerColor: color,
      order: usedSlugs.size,
      costCenterName: name,
    };
    const existingIndex = usedSlugs.get(slug);
    if (existingIndex !== undefined) {
      warnings.push(`El centro "${name}" se cargó más de una vez; se conserva el último.`);
      // Reuse color/order from the earlier one.
      withRole.centerColor = datasets[existingIndex].centerColor;
      withRole.order = datasets[existingIndex].order;
      datasets[existingIndex] = withRole;
      commentsByDataset[existingIndex] = { datasetId: withRole.id, comments };
      return;
    }
    usedSlugs.set(slug, datasets.length);
    datasets.push(withRole);
    commentsByDataset.push({ datasetId: withRole.id, comments });
  };

  // Monthly centers from sucursal statements.
  for (const s of centerStatements) {
    const name = s.result.dataset.costCenterName as string;
    if (!companyName) {
      companyName = s.result.dataset.companyName;
    } else if (companyName !== s.result.dataset.companyName) {
      warnings.push(
        `Los archivos son de empresas distintas ("${companyName}" y "${s.result.dataset.companyName}").`,
      );
    }
    pushCenter(s.result.dataset, s.result.comments, name);
  }

  // Consolidated: sin-centro dataset + annual-only fallback centers + validation.
  if (consolidatedInput) {
    const parsed = consolidatedInput.consolidated;
    if (!companyName) {
      companyName = parsed.companyName;
    } else if (companyName !== parsed.companyName) {
      warnings.push(
        `El consolidado es de otra empresa ("${parsed.companyName}") que las sucursales.`,
      );
    }

    // Fallback: centers that only exist in the consolidated (no monthly file) → annual center.
    for (const column of parsed.columns) {
      if (column.kind !== "center") {
        continue;
      }
      if (usedSlugs.has(slugifyCenter(column.name))) {
        continue;
      }
      const dataset: PygDataset = annualDatasetFromColumn(
        column.name,
        column.accounts,
        companyName,
      );
      pushCenter(dataset, [], column.name);
    }

    const sinColumn = parsed.columns.find((c) => c.kind === "sin-centro");
    if (sinColumn) {
      const sin: PygDataset = {
        ...annualDatasetFromColumn(sinColumn.name, sinColumn.accounts, companyName),
        role: "sin-centro",
        centerId: "sin-centro",
        centerColor: SIN_CENTRO_COLOR,
        order: datasets.length,
      };
      datasets.push(sin);
      commentsByDataset.push({ datasetId: sin.id, comments: [] });
    }

    warnings.push(...validateAgainstConsolidated(datasets, parsed));
  }

  return {
    mode: "multi",
    datasets,
    commentsByDataset,
    meta: { companyName, warnings, activeCenterId: "consolidado" },
  };
}

function annualDatasetFromColumn(
  name: string,
  accounts: AccountRow[],
  companyName: string,
): PygDataset {
  return {
    id: crypto.randomUUID(),
    fileName: "(consolidado)",
    uploadedAt: 0,
    companyName,
    periodLabel: "—",
    year: null,
    baseFrequency: "anual",
    role: "center",
    accounts: accounts.map((a) => ({ ...a, values: [...a.values] })),
    resultFromFile: [],
    warnings: [],
    costCenterName: name,
  };
}

/**
 * Cross-checks the assembled centers against the consolidated columns and GENERAL. Produces
 * concise, one-line-per-issue Spanish warnings (never one per account — that would be noise).
 */
function validateAgainstConsolidated(datasets: PygDataset[], parsed: ParsedConsolidated): string[] {
  const warnings: string[] = [];
  const centers = datasets.filter((d) => d.role === "center");
  const general = parsed.columns.find((c) => c.kind === "general");
  const sin = parsed.columns.find((c) => c.kind === "sin-centro");

  for (const column of parsed.columns) {
    if (column.kind !== "center") {
      continue;
    }
    const match = centers.find((c) => c.centerId === slugifyCenter(column.name));
    if (!match) {
      continue;
    }
    const mine = annualTotals(match.accounts);
    const theirs = annualTotals(column.accounts);
    let mismatches = 0;
    for (const [code, value] of theirs) {
      if (Math.abs((mine.get(code) ?? 0) - value) > SUM_TOLERANCE) {
        mismatches++;
      }
    }
    if (mismatches > 0) {
      warnings.push(
        `El centro "${column.name}" no cuadra con el consolidado en ${mismatches} cuenta(s).`,
      );
    }
  }

  if (general) {
    const generalTotals = annualTotals(general.accounts);
    const centerTotals = centers.map((c) => annualTotals(c.accounts));
    const sinTotals = sin ? annualTotals(sin.accounts) : new Map<string, number>();
    let mismatches = 0;
    for (const [code, gv] of generalTotals) {
      const sum =
        centerTotals.reduce((s, m) => s + (m.get(code) ?? 0), 0) + (sinTotals.get(code) ?? 0);
      if (Math.abs(sum - gv) > SUM_TOLERANCE) {
        mismatches++;
      }
    }
    if (mismatches > 0) {
      warnings.push(
        `El consolidado no cuadra: Σ(centros) + Sin-centro ≠ GENERAL en ${mismatches} cuenta(s).`,
      );
    }
  }
  return warnings;
}
