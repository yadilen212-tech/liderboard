import { describe, expect, it } from "vitest";
import { CHART_MAX_SERIES } from "@/lib/charts/palette";
import { makeSource } from "../analytics/fixtures";
import { MAX_SERIES, buildSeries } from "../analytics/series";
import type { AnalyticsSource } from "../analytics/types";
import type { SelectionContext } from "./selection";
import {
  amountOf,
  amountsAt,
  childrenOf,
  compositionQuery,
  excludedNote,
  lastCoveredIndex,
  leavesOf,
  presetQuery,
  topByMagnitude,
  topEntries,
} from "./presets";

const MANOR: AnalyticsSource = {
  ...makeSource(),
  centerId: "cultura-manor",
  centerName: "Cultura Manor",
};

const CONTEXT: SelectionContext = {
  sources: [MANOR],
  workspaceKey: "manor",
  activeCenterId: "cultura-manor",
  frequency: "mensual",
  year: 2026,
  focusedCodes: [],
};

describe("los presets pasan por la misma consulta que Comparar", () => {
  it("caps at the chart limit like any comparison", () => {
    const query = presetQuery(["4", "5"], CONTEXT);

    expect(query.codes).toEqual(["4", "5"]);
    expect(query.centerIds).toEqual(["cultura-manor"]);
    expect(query.frequency).toBe("mensual");
    expect(query.limit).toBe(CHART_MAX_SERIES);
  });

  it("lifts the cap for the cards that must see everything before they reduce it", () => {
    // A real statement carries 131 expense leaves; capping first would rank the first N of
    // the file instead of the largest, which is how a ranking of $0 accounts appears.
    const query = compositionQuery(leavesOf(MANOR, "5"), CONTEXT);

    expect(query.limit ?? 0).toBeGreaterThan(MAX_SERIES);
    expect(buildSeries([MANOR], query).truncated).toBe(0);
  });

  it("follows the active center", () => {
    const other = { ...CONTEXT, activeCenterId: "consolidado" };

    expect(presetQuery(["4"], other).centerIds).toEqual(["consolidado"]);
  });
});

describe("de qué se compone un total", () => {
  it("takes the movement accounts, not the single direct child", () => {
    // "5" has one child ("5.1"), which would draw a chart of one bar.
    expect(childrenOf(MANOR, "5")).toEqual(["5.1"]);
    expect(leavesOf(MANOR, "5")).toEqual([
      "5.1.1.1.1",
      "5.1.5.3",
      "5.1.5.7",
      "5.1.5.9",
      "5.1.5.12",
    ]);
  });

  it("includes the negative income row so the pie can report it as excluded", () => {
    expect(leavesOf(MANOR, "4")).toContain("4.1.4");
  });
});

describe("el periodo activo", () => {
  const bundle = buildSeries([MANOR], presetQuery(["4", "5"], CONTEXT));

  it("is the last period with movement, not the last of the year", () => {
    // The file reaches July: index 6, not 11.
    expect(lastCoveredIndex(bundle)).toBe(6);
  });

  it("is -1 when nothing was covered", () => {
    const empty = buildSeries([{ ...MANOR, coverage: new Set() }], presetQuery(["4"], CONTEXT));

    expect(lastCoveredIndex(empty)).toBe(-1);
    expect(amountsAt(empty, -1)).toEqual([]);
    expect(amountOf(empty, "4", -1)).toBeNull();
  });

  it("reads each account's amount at that period", () => {
    const index = lastCoveredIndex(bundle);

    expect(amountOf(bundle, "4", index)).toBe(25_229);
    expect(amountOf(bundle, "5", index)).toBe(20_121);
    expect(amountsAt(bundle, index).map((entry) => entry.code)).toEqual(["4", "5"]);
  });
});

describe("lo que una composición dejó fuera", () => {
  it("names the negatives one by one and counts the idle accounts", () => {
    const note = excludedNote([
      { code: "4.1.4", label: "Rebaja y/o Descuentos sobre Ventas", value: -507 },
      { code: "4.1.1.6", label: "Ventas Teléfono", value: 0 },
      { code: "4.1.1.7", label: "Ventas Parqueadero", value: 0 },
    ]);

    expect(note).toBe(
      "Fuera del pastel — negativas: Rebaja y/o Descuentos sobre Ventas; 2 cuentas sin movimiento.",
    );
  });

  it("says nothing when nothing was set aside", () => {
    expect(excludedNote([])).toBeUndefined();
  });

  it("takes the lead the card gives it", () => {
    expect(excludedNote([{ code: "5.1", label: "Gastos", value: 0 }], "Sin acumular")).toBe(
      "Sin acumular — 1 cuenta sin movimiento.",
    );
  });
});

describe("ranking", () => {
  it("sorts before cutting, so the largest cannot fall off the list", () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      code: `5.1.5.${index}`,
      label: `Gasto ${index}`,
      value: (index + 1) * 100,
    }));
    const ranked = topEntries(entries);

    expect(ranked.entries[0].value).toBe(1000);
    expect(ranked.entries).toHaveLength(8);
    expect(ranked.hidden).toBe(2);
  });

  it("reports nothing hidden when everything fits", () => {
    expect(topEntries([{ code: "5.1", label: "Gastos", value: 1 }]).hidden).toBe(0);
  });

  it("ranks a variation by absolute movement, so the falls are not pushed off the list", () => {
    const ranked = topByMagnitude(
      [
        { code: "5.1.5.3", label: "Publicidad", value: 120 },
        { code: "5.1.5.9", label: "Consumo Víveres", value: -1176 },
        { code: "5.1.5.7", label: "Mantenimiento", value: 1021 },
      ],
      2,
    );

    expect(ranked.entries.map((entry) => entry.code)).toEqual(["5.1.5.9", "5.1.5.7"]);
    expect(ranked.hidden).toBe(1);
  });

  it("drops the accounts that did not move, and does not count them as hidden", () => {
    const ranked = topEntries([
      { code: "5.1.5.3", label: "Publicidad", value: 400 },
      { code: "5.1.5.9", label: "Consumo Víveres", value: 0 },
      { code: "5.1.5.7", label: "Mantenimiento", value: 0 },
    ]);

    expect(ranked.entries.map((entry) => entry.code)).toEqual(["5.1.5.3"]);
    expect(ranked.hidden).toBe(0);
  });
});
