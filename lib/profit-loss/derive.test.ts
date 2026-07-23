import { describe, expect, it } from "vitest";
import { applyLeafEdits, buildAccountTree, computeResult, computeRollups } from "./derive";
import { MONTHLY_ACCOUNTS, MONTHLY_RESULT } from "./parse.fixtures";
import type { AccountRow, CellEdit } from "./types";

function edit(partial: Partial<CellEdit> & Pick<CellEdit, "code" | "monthIndex">): CellEdit {
  return { datasetId: "d1", updatedAt: 0, ...partial };
}

describe("buildAccountTree", () => {
  it("nests accounts by dot-prefix and derives levels", () => {
    const { roots, warnings } = buildAccountTree(MONTHLY_ACCOUNTS);
    expect(warnings).toEqual([]);
    expect(roots.map((r) => r.code)).toEqual(["4", "5"]);
    const income = roots[0];
    expect(income.children.map((c) => c.code)).toEqual(["4.1", "4.2"]);
    expect(income.children[0].children.map((c) => c.code)).toEqual(["4.1.1", "4.1.2", "4.1.3"]);
    expect(income.level).toBe(1);
    expect(income.children[0].children[0].level).toBe(3);
  });

  it("supports leaves at different depths", () => {
    const { roots } = buildAccountTree(MONTHLY_ACCOUNTS);
    const otros = roots[0].children[1]; // 4.2, leaf at level 2
    expect(otros.children).toEqual([]);
    const energia = roots[1].children[0].children[1].children[0]; // 5.1.2.1, leaf at level 4
    expect(energia.code).toBe("5.1.2.1");
    expect(energia.children).toEqual([]);
  });

  it("attaches an orphan to its nearest existing ancestor with a warning", () => {
    const rows: AccountRow[] = [
      { code: "4", name: "Ingresos", values: [0] },
      { code: "4.1.1", name: "Ventas", values: [10] }, // "4.1" missing
    ];
    const { roots, warnings } = buildAccountTree(rows);
    expect(roots[0].children.map((c) => c.code)).toEqual(["4.1.1"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("4.1.1");
  });

  it("keeps the first of duplicate codes and warns", () => {
    const rows: AccountRow[] = [
      { code: "4", name: "Primera", values: [1] },
      { code: "4", name: "Segunda", values: [2] },
    ];
    const { roots, warnings } = buildAccountTree(rows);
    expect(roots).toHaveLength(1);
    expect(roots[0].name).toBe("Primera");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("4");
  });
});

describe("computeRollups", () => {
  it("recomputes every parent from its children, leaves untouched", () => {
    // Zero out parent values to prove they get recomputed, not copied.
    const zeroedParents = MONTHLY_ACCOUNTS.map((row) =>
      ["4", "4.1", "5", "5.1", "5.1.2"].includes(row.code)
        ? { ...row, values: row.values.map(() => 0) }
        : row,
    );
    const { roots } = buildAccountTree(zeroedParents);
    const rolled = computeRollups(roots);
    const byCode = flatten(rolled);
    expect(byCode.get("4")?.values.slice(0, 4)).toEqual([130, 200, 25, 0]);
    expect(byCode.get("4.1")?.values.slice(0, 4)).toEqual([130, 200, 0, 0]);
    expect(byCode.get("5")?.values.slice(0, 4)).toEqual([90, 0, 0, 5]);
    expect(byCode.get("5.1.2")?.values.slice(0, 4)).toEqual([10, 0, 0, 5]);
    expect(byCode.get("4.1.1")?.values.slice(0, 4)).toEqual([100, 200, 0, 0]);
  });
});

describe("computeResult", () => {
  it("computes Utilidad as income roots minus expense roots", () => {
    const { roots } = buildAccountTree(MONTHLY_ACCOUNTS);
    const { values, warnings } = computeResult(computeRollups(roots));
    expect(values).toEqual(MONTHLY_RESULT);
    expect(warnings).toEqual([]);
  });

  it("excludes roots outside 4*/5* with a warning", () => {
    const rows: AccountRow[] = [
      { code: "4", name: "Ingresos", values: [100] },
      { code: "5", name: "Gastos", values: [30] },
      { code: "6", name: "Otras cuentas", values: [999] },
    ];
    const { roots } = buildAccountTree(rows);
    const { values, warnings } = computeResult(roots);
    expect(values).toEqual([70]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("6");
  });
});

describe("applyLeafEdits", () => {
  it("overrides leaf values and leaves other nodes' identity intact", () => {
    const { roots } = buildAccountTree(MONTHLY_ACCOUNTS);
    const edited = applyLeafEdits(roots, [edit({ code: "4.1.1", monthIndex: 0, value: 0 })]);
    const byCode = flatten(edited);
    expect(byCode.get("4.1.1")?.values[0]).toBe(0);
    expect(byCode.get("4.1.1")?.values[1]).toBe(200);
    // Untouched subtree keeps identity (memo-friendliness).
    expect(edited[1]).toBe(roots[1]);
  });

  it("ignores value edits on parents and treats null as 0", () => {
    const { roots } = buildAccountTree(MONTHLY_ACCOUNTS);
    const edited = applyLeafEdits(roots, [
      edit({ code: "4.1", monthIndex: 0, value: 12345 }), // parent — ignored
      edit({ code: "4.1.2", monthIndex: 0, value: null }), // null clears to 0
      edit({ code: "4.1.3", monthIndex: 0, comment: "solo comentario" }), // no value — ignored here
    ]);
    const byCode = flatten(edited);
    expect(byCode.get("4.1")?.values[0]).toBe(130);
    expect(byCode.get("4.1.2")?.values[0]).toBe(0);
    expect(byCode.get("4.1.3")?.values[0]).toBe(-20);
  });
});

/** Test helper: flatten a tree into a code → node map. */
function flatten(roots: ReturnType<typeof buildAccountTree>["roots"]) {
  const map = new Map<string, (typeof roots)[number]>();
  const walk = (nodes: typeof roots) => {
    for (const node of nodes) {
      map.set(node.code, node);
      walk(node.children);
    }
  };
  walk(roots);
  return map;
}
