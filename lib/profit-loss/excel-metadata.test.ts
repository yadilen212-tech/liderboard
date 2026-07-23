import { describe, expect, it } from "vitest";
import { commentsToMetaRows, META_SHEET_NAME, metaRowsToComments } from "./excel-metadata";

describe("excel-metadata", () => {
  it("round-trips comments through the metadata rows (header dropped)", () => {
    const comments = [
      { code: "4.1.1", monthIndex: 0, comment: "Ajuste de enero" },
      { code: "5.1.2.1", monthIndex: 3, comment: "Revisar con contabilidad\nsegunda línea" },
    ];
    const rows = commentsToMetaRows(comments);
    expect(rows[0]).toEqual(["code", "monthIndex", "comment"]);
    expect(metaRowsToComments(rows)).toEqual(comments);
  });

  it("drops the header and any invalid row on decode", () => {
    const rows: unknown[][] = [
      ["code", "monthIndex", "comment"], // header: monthIndex is not a number → dropped
      ["4.1.1", 0, "ok"],
      ["", 1, "sin código"], // empty code → dropped
      ["4.2", "x", "mes no numérico"], // non-number monthIndex → dropped
      ["4.3", 2, ""], // empty comment → dropped
      ["4.4", 5, "  con espacios  "], // valid; comment kept verbatim
    ];
    expect(metaRowsToComments(rows)).toEqual([
      { code: "4.1.1", monthIndex: 0, comment: "ok" },
      { code: "4.4", monthIndex: 5, comment: "  con espacios  " },
    ]);
  });

  it("exposes a stable, non-empty sheet name", () => {
    expect(META_SHEET_NAME).toBeTruthy();
  });
});
