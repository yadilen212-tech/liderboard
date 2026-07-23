/**
 * Builds the downloadable PyG workbooks with `exceljs` (formatting + cell notes, which
 * SheetJS community can't write). Imported statically here; UI code must load this module
 * via dynamic `import()` so exceljs stays out of the initial bundle.
 *
 * The "con tus datos" workbook mirrors the upload structure so it re-parses cleanly
 * (round-trip): preamble → header → account rows → result row. Edited leaves and rolled-up
 * parents come from `toDatosGrid`; every edited cell carries a note with its original value,
 * and every comment becomes a note too. A hidden metadata sheet lets `parse` restore the
 * comments on re-upload (see `excel-metadata.ts`).
 */
import ExcelJS from "exceljs";
import { MONTHS_FULL_ES } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import type { DatosCell, DatosRow } from "./datos-types";
import { applyEditsToLeafAccounts, buildAccountTree, mergeCenters, toDatosGrid } from "./derive";
import { commentsToMetaRows, META_SHEET_NAME } from "./excel-metadata";
import type { AccountNode } from "./derive";
import type { CellEdit, ImportedComment, PygDataset } from "./types";

const CODE_COL = 1;
const NAME_COL = 2;
const FIRST_VALUE_COL = 3;
/** Ecuador USD, sign before the symbol: "$1.234,00" / "-$1.234,00" (viewer-locale grouping). */
const CURRENCY_FMT = '"$"#,##0.00;"-$"#,##0.00';
const SHEET_NAME = "Estado de Resultados";

/** The Estado de Resultados with edited values and comments, ready to download. */
export function buildPygWorkbook(dataset: PygDataset, edits: CellEdit[]): ExcelJS.Workbook {
  const wb = newWorkbook();
  writeStatementSheet(wb, SHEET_NAME, dataset, edits);
  attachMetadata(wb, edits);
  return wb;
}

/** Writes one Estado de Resultados worksheet (preamble → header → rows → result) into `wb`. */
function writeStatementSheet(
  wb: ExcelJS.Workbook,
  name: string,
  dataset: PygDataset,
  edits: CellEdit[],
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name);
  const isMonthly = dataset.baseFrequency !== "anual";

  writePreamble(ws, dataset);
  const headerRowNumber = writeHeader(ws, isMonthly);
  setColumnWidths(ws, isMonthly);
  freeze(ws, headerRowNumber);

  const grid = toDatosGrid(dataset, edits, dataset.baseFrequency);
  const originals = new Map(dataset.accounts.map((account) => [account.code, account.values]));
  const valueEdits = indexValueEdits(edits);
  emitDataRows(ws, grid.rows, { isMonthly, originals, valueEdits });
  return ws;
}

/** A blank template seeded with the dataset's accounts (values empty) to fill and re-upload. */
export function buildBlankTemplate(dataset?: PygDataset): ExcelJS.Workbook {
  const wb = newWorkbook();
  const ws = wb.addWorksheet(SHEET_NAME);
  const isMonthly = !dataset || dataset.baseFrequency !== "anual";

  writePreamble(ws, dataset);
  const headerRowNumber = writeHeader(ws, isMonthly);
  setColumnWidths(ws, isMonthly);
  freeze(ws, headerRowNumber);

  if (dataset) {
    const { roots } = buildAccountTree(dataset.accounts);
    emitTemplateRows(ws, roots, isMonthly);
  }
  return wb;
}

/** Serializes a workbook to a Blob for `downloadBlob`. */
export async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** `PyG <empresa> <periodo>.xlsx` / `Plantilla PyG <empresa>.xlsx`, filesystem-safe. */
export function pygExportFilename(
  dataset: PygDataset | undefined,
  kind: "data" | "template",
): string {
  const company = sanitize(dataset?.companyName ?? "") || "LiderPlus";
  if (kind === "template") {
    return `Plantilla PyG ${company}.xlsx`;
  }
  const period =
    dataset?.periodLabel && dataset.periodLabel !== "—" ? ` ${dataset.periodLabel}` : "";
  return `PyG ${company}${period}.xlsx`;
}

// ── internals ──────────────────────────────────────────────────────────────

interface EmitContext {
  isMonthly: boolean;
  originals: Map<string, number[]>;
  valueEdits: Map<string, CellEdit>;
}

function newWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LiderPlus";
  return wb;
}

function writePreamble(ws: ExcelJS.Worksheet, dataset?: PygDataset): void {
  ws.addRow([dataset?.companyName || "LiderPlus"]).getCell(CODE_COL).font = {
    bold: true,
    size: 14,
  };
  ws.addRow(["Estado de Resultados"]).getCell(CODE_COL).font = {
    bold: true,
    color: { argb: "FF64748B" },
  };
  if (dataset?.costCenterName) {
    ws.addRow([`Centro de Costo: ${dataset.costCenterName}`]);
  }
  if (dataset?.year != null) {
    ws.addRow([`Desde el 01/01/${dataset.year} hasta el 31/12/${dataset.year}`]);
  }
  ws.addRow([]);
}

function writeHeader(ws: ExcelJS.Worksheet, isMonthly: boolean): number {
  const labels = isMonthly ? [...MONTHS_FULL_ES, "Total"] : ["Total"];
  const row = ws.addRow(["", "", ...labels]);
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.alignment = { horizontal: "center" };
  });
  return row.number;
}

function setColumnWidths(ws: ExcelJS.Worksheet, isMonthly: boolean): void {
  ws.getColumn(CODE_COL).width = 12;
  ws.getColumn(NAME_COL).width = 42;
  const valueCols = isMonthly ? 13 : 1; // 12 months + Total, or a single Total
  for (let i = 0; i < valueCols; i++) {
    ws.getColumn(FIRST_VALUE_COL + i).width = 13;
  }
}

function freeze(ws: ExcelJS.Worksheet, headerRowNumber: number): void {
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: headerRowNumber }];
}

function indexValueEdits(edits: CellEdit[]): Map<string, CellEdit> {
  const map = new Map<string, CellEdit>();
  for (const edit of edits) {
    if (edit.value !== undefined) {
      map.set(cellKey(edit.code, edit.monthIndex), edit);
    }
  }
  return map;
}

function emitDataRows(ws: ExcelJS.Worksheet, rows: DatosRow[], ctx: EmitContext): void {
  for (const row of rows) {
    writeDataRow(ws, row, ctx);
    if (row.children) {
      emitDataRows(ws, row.children, ctx);
    }
  }
}

function writeDataRow(ws: ExcelJS.Worksheet, row: DatosRow, ctx: EmitContext): void {
  const values = row.cells.map((cell) => cell.value ?? 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  const r = ws.addRow([row.code, row.name, ...values, ...(ctx.isMonthly ? [total] : [])]);

  const isParent = Boolean(row.children?.length);
  if (isParent || row.isResult) {
    r.font = { bold: true };
  }
  r.getCell(NAME_COL).alignment = { indent: Math.max(0, row.level - 1) };

  const lastValueCol = FIRST_VALUE_COL + row.cells.length - 1;
  const lastCol = ctx.isMonthly ? lastValueCol + 1 : lastValueCol;
  for (let col = FIRST_VALUE_COL; col <= lastCol; col++) {
    r.getCell(col).numFmt = CURRENCY_FMT;
  }

  if (row.isResult) {
    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: { style: "thin", color: { argb: "FF94A3B8" } } };
    });
    return; // no notes on the summary row
  }

  row.cells.forEach((cell, monthIndex) => {
    const note = cellNote(row.code, monthIndex, cell, ctx);
    if (note) {
      r.getCell(FIRST_VALUE_COL + monthIndex).note = note;
    }
  });
}

/**
 * Comment-only cells carry their text; edited cells carry `Valor original: $X → $Y`
 * (plus the comment when there is one) so an edit is never invisible under "solo la nota".
 */
function cellNote(
  code: string,
  monthIndex: number,
  cell: DatosCell,
  ctx: EmitContext,
): string | undefined {
  const edited = ctx.valueEdits.get(cellKey(code, monthIndex));
  if (edited) {
    const original = ctx.originals.get(code)?.[monthIndex] ?? 0;
    const annotation = `Valor original: ${money(original)} → ${money(cell.value ?? 0)}`;
    return cell.comment ? `${cell.comment}\n\n${annotation}` : annotation;
  }
  return cell.comment || undefined;
}

function emitTemplateRows(ws: ExcelJS.Worksheet, nodes: AccountNode[], isMonthly: boolean): void {
  const valueCols = isMonthly ? 13 : 1;
  for (const node of nodes) {
    const r = ws.addRow([node.code, node.name]);
    if (node.children.length > 0) {
      r.font = { bold: true };
    }
    r.getCell(NAME_COL).alignment = { indent: Math.max(0, node.level - 1) };
    for (let i = 0; i < valueCols; i++) {
      r.getCell(FIRST_VALUE_COL + i).numFmt = CURRENCY_FMT;
    }
    emitTemplateRows(ws, node.children, isMonthly);
  }
}

function attachMetadata(wb: ExcelJS.Workbook, edits: CellEdit[]): void {
  const comments: ImportedComment[] = edits
    .filter((edit) => edit.comment)
    .map((edit) => ({
      code: edit.code,
      monthIndex: edit.monthIndex,
      comment: edit.comment as string,
    }));
  if (comments.length === 0) {
    return;
  }
  const meta = wb.addWorksheet(META_SHEET_NAME, { state: "veryHidden" });
  meta.addRows(commentsToMetaRows(comments));
}

function cellKey(code: string, monthIndex: number): string {
  return `${code}:${monthIndex}`;
}

function money(value: number): string {
  return formatCurrency(value, { cents: true });
}

function sanitize(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface MultiCenterInput {
  companyName: string;
  centers: { dataset: PygDataset; edits: CellEdit[] }[];
  sinCentro?: PygDataset;
}

/**
 * A multi-sheet workbook: a computed "Consolidado" sheet (sum of the monthly centers), one
 * sheet per center (with its edits/comments), and a "Sin centro de costo" sheet (annual) when
 * present. Sheet names are Excel-safe (≤31 chars, unique).
 */
export function buildMultiCenterWorkbook(input: MultiCenterInput): ExcelJS.Workbook {
  const wb = newWorkbook();
  const used = new Set<string>();

  const base = input.centers[0]?.dataset;
  if (base) {
    // Apply each center's edits before merging so the Consolidado sheet equals the sum of the
    // (edited) center sheets — never the stale pre-edit values.
    const merged = mergeCenters(
      input.centers.map((c) => applyEditsToLeafAccounts(c.dataset.accounts, c.edits)),
    );
    const consolidated: PygDataset = {
      ...base,
      id: "consolidado",
      role: "center",
      costCenterName: undefined,
      accounts: merged.accounts,
      resultFromFile: [],
    };
    writeStatementSheet(wb, uniqueSheetName("Consolidado", used), consolidated, []);
  }

  for (const { dataset, edits } of input.centers) {
    const name = uniqueSheetName(dataset.costCenterName || "Centro", used);
    writeStatementSheet(wb, name, dataset, edits);
    attachCenterMetadata(wb, name, edits, used);
  }

  if (input.sinCentro) {
    writeStatementSheet(wb, uniqueSheetName("Sin centro de costo", used), input.sinCentro, []);
  }
  return wb;
}

/** Excel forbids > 31 chars, the chars \ / ? * [ ] :, and duplicate sheet names. */
function uniqueSheetName(raw: string, used: Set<string>): string {
  const cleaned =
    raw
      .replace(/[\\/?*[\]:]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Hoja";
  let name = cleaned.slice(0, 31);
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n})`;
    name = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
    n++;
  }
  used.add(name.toLowerCase());
  return name;
}

/** Comments for a re-uploadable per-center sheet go in a per-sheet hidden metadata sheet. */
function attachCenterMetadata(
  wb: ExcelJS.Workbook,
  centerName: string,
  edits: CellEdit[],
  used: Set<string>,
): void {
  const comments = edits.filter((e) => e.comment);
  if (comments.length === 0) {
    return;
  }
  // Share the workbook's sheet-name set so two centers whose meta names truncate alike stay unique.
  const metaName = uniqueSheetName(`${META_SHEET_NAME}-${centerName}`, used);
  const meta = wb.addWorksheet(metaName, { state: "veryHidden" });
  meta.addRows(
    commentsToMetaRows(
      comments.map((e) => ({
        code: e.code,
        monthIndex: e.monthIndex,
        comment: e.comment as string,
      })),
    ),
  );
}
