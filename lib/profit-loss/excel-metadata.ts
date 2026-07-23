/**
 * The bridge that lets comments survive a download → re-upload round-trip. Exported
 * workbooks carry a hidden metadata sheet with one row per comment; `parse` reads it back.
 *
 * Pure and library-agnostic on purpose: it works on arrays-of-arrays, so `exceljs` (which
 * writes the sheet) and SheetJS `xlsx` (which reads it) both use these helpers without
 * importing each other. Value edits are NOT stored here — they fold into the new baseline.
 */
import type { ImportedComment } from "./types";

/** Obscure name so it can't collide with a real accounting sheet; hidden in the workbook. */
export const META_SHEET_NAME = "_liderplus_meta";

const META_HEADER = ["code", "monthIndex", "comment"] as const;

/** Comments → the sheet's rows (header first). Callers pass only edits that have text. */
export function commentsToMetaRows(comments: ImportedComment[]): (string | number)[][] {
  return [
    [...META_HEADER],
    ...comments.map(({ code, monthIndex, comment }) => [code, monthIndex, comment]),
  ];
}

/**
 * Rows → comments, keeping only well-formed data rows. The header (a non-numeric
 * `monthIndex` cell) and any malformed row fail validation and drop out, so no explicit
 * header-skipping is needed. Comment text is kept verbatim (never trimmed).
 */
export function metaRowsToComments(rows: unknown[][]): ImportedComment[] {
  const comments: ImportedComment[] = [];
  for (const row of rows) {
    const [code, monthIndex, comment] = row;
    if (
      typeof code === "string" &&
      code.trim() !== "" &&
      typeof monthIndex === "number" &&
      Number.isInteger(monthIndex) &&
      typeof comment === "string" &&
      comment !== ""
    ) {
      comments.push({ code: code.trim(), monthIndex, comment });
    }
  }
  return comments;
}
