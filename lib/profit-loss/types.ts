/**
 * Contracts for the PyG Excel data layer. `AccountRow` is the file's original truth —
 * never mutated; user changes live in `CellEdit` overlays so a future
 * original-vs-edited comparison needs no migration.
 */

export type Frequency = "mensual" | "trimestral" | "semestral" | "anual";

/** One account row exactly as parsed — original values, never mutated. */
export interface AccountRow {
  code: string;
  name: string;
  /** Monthly base: length 12 (month index 0–11). Annual base: length 1. */
  values: number[];
}

export interface PygDataset {
  id: string;
  fileName: string;
  uploadedAt: number;
  companyName: string;
  /** e.g. "Ene–Dic 2026"; "—" when the file has no date-range line. */
  periodLabel: string;
  year: number | null;
  /** Frequency the file provides; the UI can aggregate up, never down. */
  baseFrequency: Frequency;
  /** Sucursal files carry "Centro de Costo: X"; kept as metadata only. */
  costCenterName?: string;
  /** Flat, in file order, parents included with their original values. */
  accounts: AccountRow[];
  /** The file's own "Utilidad o Pérdida" row — validation/comparison only. */
  resultFromFile: number[];
  /** Spanish, human-readable parse/validation notes. */
  warnings: string[];
}

/**
 * A comment carried in an exported workbook's hidden metadata sheet, reconstructed on
 * re-upload. Value edits fold into the new baseline; only comments round-trip.
 */
export interface ImportedComment {
  code: string;
  /** Base-frequency column index (month for a monthly base). */
  monthIndex: number;
  comment: string;
}

/** What `parsePygWorkbook` yields: the dataset plus any comments to re-seed as edits. */
export interface PygParseResult {
  dataset: PygDataset;
  comments: ImportedComment[];
}

/** A user edit overlay — never mutates `AccountRow.values`. */
export interface CellEdit {
  id?: number;
  datasetId: string;
  code: string;
  /** Column index in the base frequency (month for a monthly base). */
  monthIndex: number;
  /** Only leaf (movement) accounts hold a value edit; `null` clears the cell. */
  value?: number | null;
  comment?: string;
  updatedAt: number;
}
