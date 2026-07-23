import { describe, expect, it } from "vitest";
import { parseConsolidatedWorkbook, parsePygWorkbook } from "./parse";
import {
  aoaToXlsxBuffer,
  CONSOLIDATED_AOA,
  MONTHLY_AOA,
  SUCURSAL_AOA,
  SUCURSAL_SUR_AOA,
} from "./parse.fixtures";
import { buildWorkspace, slugifyCenter, type StagedParse } from "./workspace";

function statement(aoa: Parameters<typeof aoaToXlsxBuffer>[0], name: string): StagedParse {
  return { format: "statement", result: parsePygWorkbook(aoaToXlsxBuffer(aoa), name) };
}
function consolidated(): StagedParse {
  return {
    format: "consolidated",
    consolidated: parseConsolidatedWorkbook(aoaToXlsxBuffer(CONSOLIDATED_AOA), "c.xlsx"),
  };
}

describe("slugifyCenter", () => {
  it("normalizes to an ascii kebab slug", () => {
    expect(slugifyCenter("CENTRO DE COSTO PRINCIPAL")).toBe("centro-de-costo-principal");
    expect(slugifyCenter("Cultura Manor")).toBe("cultura-manor");
  });
});

describe("buildWorkspace", () => {
  it("returns single mode for one center-less statement", () => {
    const ws = buildWorkspace([statement(MONTHLY_AOA, "m.xlsx")]);
    expect(ws.mode).toBe("single");
    expect(ws.datasets).toHaveLength(1);
    expect(ws.datasets[0].role).toBe("single");
    expect(ws.meta.activeCenterId).toBe(ws.datasets[0].id);
  });

  it("builds two centers with palette colors and order", () => {
    const ws = buildWorkspace([
      statement(SUCURSAL_AOA, "norte.xls"), // "SUCURSAL NORTE"
      statement(SUCURSAL_SUR_AOA, "sur.xls"), // "SUCURSAL SUR"
    ]);
    expect(ws.mode).toBe("multi");
    const centers = ws.datasets.filter((d) => d.role === "center");
    expect(centers.map((c) => c.centerId)).toEqual(["sucursal-norte", "sucursal-sur"]);
    expect(centers[0].centerColor).toBeTruthy();
    expect(centers[0].order).toBe(0);
    expect(centers[1].order).toBe(1);
    expect(ws.meta.activeCenterId).toBe("consolidado");
  });

  it("adds a sin-centro dataset and validation warnings from the consolidated", () => {
    const ws = buildWorkspace([
      statement(SUCURSAL_AOA, "norte.xls"),
      statement(SUCURSAL_SUR_AOA, "sur.xls"),
      consolidated(),
    ]);
    const sin = ws.datasets.find((d) => d.role === "sin-centro");
    expect(sin).toBeTruthy();
    expect(sin?.baseFrequency).toBe("anual");
    // SUCURSAL_AOA totals do not match the consolidated columns → at least one cuadre warning.
    expect(ws.meta.warnings.length).toBeGreaterThan(0);
  });

  it("does not add an annual fallback center when monthly centers exist (avoids width mixing)", () => {
    // Stage only NORTE (monthly) + the consolidated (which also has SUR + sin-centro).
    const ws = buildWorkspace([statement(SUCURSAL_AOA, "norte.xls"), consolidated()]);
    const centers = ws.datasets.filter((d) => d.role === "center");
    // Only the monthly NORTE center — SUR (uncovered) must NOT become an annual center.
    expect(centers.map((c) => c.centerId)).toEqual(["sucursal-norte"]);
    expect(centers.every((c) => c.baseFrequency === "mensual")).toBe(true);
    expect(ws.datasets.some((d) => d.role === "sin-centro")).toBe(true);
    expect(ws.meta.warnings.some((w) => w.includes("sin archivo mensual"))).toBe(true);
  });

  it("degrades a consolidated-only upload to annual read-only centers", () => {
    const ws = buildWorkspace([consolidated()]);
    expect(ws.mode).toBe("multi");
    const centers = ws.datasets.filter((d) => d.role === "center");
    expect(centers).toHaveLength(2); // SUCURSAL NORTE + SUCURSAL SUR
    expect(centers[0].baseFrequency).toBe("anual");
    expect(ws.datasets.some((d) => d.role === "sin-centro")).toBe(true);
  });
});
