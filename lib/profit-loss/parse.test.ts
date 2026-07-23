import { describe, expect, it } from "vitest";
import { PygParseError } from "./errors";
import { parsePygWorkbook } from "./parse";
import {
  ANNUAL_AOA,
  aoaToXlsxBuffer,
  CONSOLIDATED_AOA,
  MISMATCHED_PARENT_AOA,
  MONTHLY_AOA,
  MONTHLY_RESULT,
  NO_ACCOUNTS_AOA,
  PARTIAL_MONTHS_AOA,
  SUCURSAL_AOA,
} from "./parse.fixtures";

function parse(aoa: Parameters<typeof aoaToXlsxBuffer>[0], name = "reporte.xlsx") {
  return parsePygWorkbook(aoaToXlsxBuffer(aoa), name);
}

function errorCode(aoa: Parameters<typeof aoaToXlsxBuffer>[0]): string {
  try {
    parse(aoa);
  } catch (error) {
    if (error instanceof PygParseError) {
      return error.code;
    }
    throw error;
  }
  throw new Error("expected parse to fail");
}

describe("parsePygWorkbook — monthly format", () => {
  it("parses metadata, accounts and the file result row", () => {
    const dataset = parse(MONTHLY_AOA, "ReportePyG-mensual2026.xlsx");
    expect(dataset.companyName).toBe("HOTELERA ANDES S.A.");
    expect(dataset.fileName).toBe("ReportePyG-mensual2026.xlsx");
    expect(dataset.baseFrequency).toBe("mensual");
    expect(dataset.year).toBe(2026);
    expect(dataset.periodLabel).toBe("Ene–Dic 2026");
    expect(dataset.costCenterName).toBeUndefined();
    expect(dataset.accounts).toHaveLength(11);
    const habitaciones = dataset.accounts.find((a) => a.code === "4.1.1");
    expect(habitaciones?.values).toHaveLength(12);
    expect(habitaciones?.values.slice(0, 2)).toEqual([100, 200]);
    expect(dataset.resultFromFile).toEqual(MONTHLY_RESULT);
    expect(dataset.warnings).toEqual([]);
    expect(dataset.id).toBeTruthy();
  });

  it("parses the sucursal variant (shifted header) and keeps the center name", () => {
    const dataset = parse(SUCURSAL_AOA);
    expect(dataset.costCenterName).toBe("SUCURSAL NORTE");
    expect(dataset.baseFrequency).toBe("mensual");
    expect(dataset.accounts).toHaveLength(11);
    expect(dataset.warnings).toEqual([]);
  });

  it("zero-fills missing month columns with a warning", () => {
    const dataset = parse(PARTIAL_MONTHS_AOA);
    expect(dataset.baseFrequency).toBe("mensual");
    const ingresos = dataset.accounts.find((a) => a.code === "4");
    expect(ingresos?.values).toHaveLength(12);
    expect(ingresos?.values.slice(0, 3)).toEqual([130, 200, 25]);
    expect(ingresos?.values.slice(6)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(dataset.warnings.some((w) => w.includes("meses"))).toBe(true);
  });

  it("warns when a parent row disagrees with the sum of its children", () => {
    const dataset = parse(MISMATCHED_PARENT_AOA);
    expect(dataset.warnings.some((w) => w.includes("4.1"))).toBe(true);
  });
});

describe("parsePygWorkbook — annual format", () => {
  it("parses a Total-only file as base anual", () => {
    const dataset = parse(ANNUAL_AOA);
    expect(dataset.baseFrequency).toBe("anual");
    expect(dataset.accounts.find((a) => a.code === "4")?.values).toEqual([355]);
    expect(dataset.resultFromFile).toEqual([260]);
    expect(dataset.warnings).toEqual([]);
  });
});

describe("parsePygWorkbook — rejections", () => {
  it("rejects consolidated cost-center files", () => {
    expect(errorCode(CONSOLIDATED_AOA)).toBe("consolidated-unsupported");
  });

  it("rejects files without account rows", () => {
    expect(errorCode(NO_ACCOUNTS_AOA)).toBe("no-accounts");
  });

  it("maps unreadable buffers to invalid-file", () => {
    // A corrupt ZIP header: XLSX.read must throw (plain text could parse as CSV).
    const garbage = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02, 0x03]).buffer;
    try {
      parsePygWorkbook(garbage, "x.xls");
      throw new Error("expected parse to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PygParseError);
      expect((error as PygParseError).code).toBe("invalid-file");
    }
  });
});
