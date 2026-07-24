import { describe, expect, it } from "vitest";
import { CHART_MAX_SERIES, CHART_NEUTRAL, CHART_PALETTE } from "@/lib/charts/palette";
import { buildSeries } from "../analytics/series";
import { makeSource } from "../analytics/fixtures";
import type { AnalyticsSource } from "../analytics/types";
import {
  codeColorResolver,
  colorResolver,
  emptySelection,
  entryOptionsFor,
  isComparing,
  sanitizeSelection,
  selectedIdsFor,
  shapeFor,
  toSeriesQuery,
  withCross,
  withDimension,
  withEntryToggled,
  type AnalyticsSelection,
  type SelectionContext,
} from "./selection";

const HABITACIONES = "4.1.1.1.1.1";
const RESTAURANTE = "4.1.1.2";
const LAVANDERIA = "4.1.1.5";

const MANOR = withIdentity(makeSource(), "cultura-manor", "Cultura Manor");
const PRINCIPAL = withIdentity(
  // The real second center is ~100× smaller and never reports Ventas Lavandería.
  makeSource({ centerId: "centro-de-costo-principal", scale: 0.01, omit: [LAVANDERIA] }),
  "centro-de-costo-principal",
  "Centro de Costo Principal",
);
const CONSOLIDADO = withIdentity(makeSource(), "consolidado", "Consolidado");

const SOURCES = [CONSOLIDADO, MANOR, PRINCIPAL];
const WORKSPACE = "manor|principal";

function withIdentity(source: AnalyticsSource, centerId: string, centerName: string) {
  return { ...source, centerId, centerName };
}

function makeContext(overrides: Partial<SelectionContext> = {}): SelectionContext {
  return {
    sources: SOURCES,
    workspaceKey: WORKSPACE,
    activeCenterId: "cultura-manor",
    frequency: "mensual",
    year: 2026,
    focusedCodes: [],
    ...overrides,
  };
}

function makeSelection(overrides: Partial<AnalyticsSelection> = {}): AnalyticsSelection {
  return { ...emptySelection(WORKSPACE), ...overrides };
}

describe("traducción de la selección a una consulta", () => {
  it("asks for a single series of the active center with no dimension", () => {
    const query = toSeriesQuery(makeSelection(), makeContext({ focusedCodes: [HABITACIONES] }));

    expect(query.codes).toEqual([HABITACIONES]);
    expect(query.centerIds).toEqual(["cultura-manor"]);
    expect(query.years).toEqual([2026]);
    expect(buildSeries(SOURCES, query).series).toHaveLength(1);
  });

  it("carries the focused account and the chosen centers when comparing by centros", () => {
    const query = toSeriesQuery(
      makeSelection({
        dimension: "centros",
        centerIds: ["cultura-manor", "centro-de-costo-principal"],
      }),
      makeContext({ focusedCodes: [HABITACIONES] }),
    );

    expect(query.codes).toEqual([HABITACIONES]);
    expect(query.centerIds).toEqual(["cultura-manor", "centro-de-costo-principal"]);
  });

  it("expands a level into every account at that depth of the active center", () => {
    const query = toSeriesQuery(
      makeSelection({ dimension: "niveles", levels: [3] }),
      makeContext(),
    );

    expect(query.codes.length).toBeGreaterThan(0);
    expect(query.codes.every((code) => code.split(".").length === 3)).toBe(true);
    expect(query.codes).toContain("4.1.1");
    expect(query.codes).toContain("5.1.5");
  });

  it("produces the cartesian product of two dimensions when crossing", () => {
    const query = toSeriesQuery(
      makeSelection({
        dimension: "cuentas",
        codes: [HABITACIONES, RESTAURANTE],
        cross: "centros",
        centerIds: ["consolidado", "cultura-manor", "centro-de-costo-principal"],
      }),
      makeContext(),
    );

    expect(query.codes).toHaveLength(2);
    expect(query.centerIds).toHaveLength(3);
    expect(buildSeries(SOURCES, query).series).toHaveLength(6);
  });

  it("always takes the frequency from the shared control", () => {
    const selection = makeSelection({ dimension: "cuentas", codes: [HABITACIONES] });

    expect(toSeriesQuery(selection, makeContext()).frequency).toBe("mensual");
    expect(toSeriesQuery(selection, makeContext({ frequency: "trimestral" })).frequency).toBe(
      "trimestral",
    );
  });

  it("never exceeds the chart cap nor departs from the context frequency", () => {
    const everyDimension = [
      makeSelection(),
      makeSelection({ dimension: "cuentas", codes: [HABITACIONES, RESTAURANTE] }),
      makeSelection({ dimension: "centros", centerIds: ["consolidado", "cultura-manor"] }),
      makeSelection({ dimension: "niveles", levels: [2, 3, 4] }),
      makeSelection({
        dimension: "cuentas",
        codes: [HABITACIONES, RESTAURANTE],
        cross: "centros",
        centerIds: ["consolidado", "cultura-manor", "centro-de-costo-principal"],
      }),
    ];

    for (const frequency of ["mensual", "trimestral", "semestral", "anual"] as const) {
      for (const selection of everyDimension) {
        const query = toSeriesQuery(selection, makeContext({ frequency }));
        expect(query.limit).toBe(CHART_MAX_SERIES);
        expect(query.limit).toBeLessThanOrEqual(8);
        expect(query.frequency).toBe(frequency);
      }
    }
  });

  it("narrows the X axis when comparing by periodos", () => {
    const periods = [
      { year: 2026, frequency: "mensual" as const, index: 0 },
      { year: 2026, frequency: "mensual" as const, index: 1 },
    ];
    const query = toSeriesQuery(
      makeSelection({ dimension: "periodos", periods }),
      makeContext({ focusedCodes: [HABITACIONES] }),
    );

    expect(query.periods).toEqual(periods);
    expect(buildSeries(SOURCES, query).periods).toHaveLength(2);
  });
});

describe("saneamiento de la selección", () => {
  it("resets everything when another workspace is loaded", () => {
    const selection = makeSelection({
      dimension: "cuentas",
      codes: [HABITACIONES, RESTAURANTE, LAVANDERIA],
    });
    const sanitized = sanitizeSelection(selection, makeContext({ workspaceKey: "otro-excel" }));

    expect(sanitized).toEqual(emptySelection("otro-excel"));
    expect(isComparing(sanitized)).toBe(false);
  });

  it("drops an account the new center does not report and keeps the rest", () => {
    const selection = makeSelection({
      dimension: "cuentas",
      codes: [HABITACIONES, LAVANDERIA, RESTAURANTE],
    });
    const sanitized = sanitizeSelection(
      selection,
      makeContext({ activeCenterId: "centro-de-costo-principal" }),
    );

    expect(sanitized.codes).toEqual([HABITACIONES, RESTAURANTE]);
    expect(isComparing(sanitized)).toBe(true);
  });

  it("keeps the selection when moving to a coarser frequency", () => {
    const selection = makeSelection({
      dimension: "cuentas",
      codes: [HABITACIONES, RESTAURANTE],
    });
    const sanitized = sanitizeSelection(selection, makeContext({ frequency: "trimestral" }));

    expect(sanitized.codes).toEqual([HABITACIONES, RESTAURANTE]);
    expect(sanitized.dimension).toBe("cuentas");
  });

  it("drops the periods a coarser frequency left off the axis", () => {
    const selection = makeSelection({
      dimension: "periodos",
      periods: [
        { year: 2026, frequency: "mensual", index: 0 },
        { year: 2026, frequency: "mensual", index: 9 },
      ],
    });
    const sanitized = sanitizeSelection(selection, makeContext({ frequency: "trimestral" }));

    expect(sanitized.periods).toEqual([]);
    // The dimension stays so the picker is still reachable; the tab falls back to its preset.
    expect(sanitized.dimension).toBe("periodos");
    expect(isComparing(sanitized)).toBe(false);
  });

  it("falls back to the preset when the pruning empties the axis", () => {
    const selection = makeSelection({ dimension: "cuentas", codes: [LAVANDERIA] });
    const sanitized = sanitizeSelection(
      selection,
      makeContext({ activeCenterId: "centro-de-costo-principal" }),
    );

    expect(sanitized.codes).toEqual([]);
    expect(isComparing(sanitized)).toBe(false);
  });

  it("keeps a freshly picked dimension so the picker can still be filled", () => {
    // Choosing "Centros" before adding any center must not snap the box back to «Nada».
    const picked = withDimension(makeSelection(), "centros");
    const sanitized = sanitizeSelection(picked, makeContext());

    expect(sanitized.dimension).toBe("centros");
    expect(isComparing(sanitized)).toBe(false);
  });

  it("drops the cross when its own axis empties, keeping the primary", () => {
    const selection = makeSelection({
      dimension: "cuentas",
      codes: [HABITACIONES],
      cross: "centros",
      centerIds: ["centro-que-ya-no-existe"],
    });
    const sanitized = sanitizeSelection(selection, makeContext());

    expect(sanitized.dimension).toBe("cuentas");
    expect(sanitized.cross).toBe("nada");
    expect(sanitized.centerIds).toEqual([]);
  });

  it("clamps a shape the transformation does not admit", () => {
    const selection = makeSelection({ transform: "index100", chartType: "pastel" });

    expect(sanitizeSelection(selection, makeContext()).chartType).toBe("linea");
    expect(shapeFor("pct-contenedor", "linea")).toBe("barras-100");
    expect(shapeFor("montos", "linea")).toBe("linea");
  });
});

describe("tope de series de una gráfica", () => {
  it("draws everything and warns about nothing when the selection fits", () => {
    const codes = [...MANOR.valuesByCode.keys()].slice(0, 6);
    const bundle = buildSeries(
      SOURCES,
      toSeriesQuery(makeSelection({ dimension: "cuentas", codes }), makeContext()),
    );

    expect(bundle.series).toHaveLength(6);
    expect(bundle.truncated).toBe(0);
    expect(bundle.warnings).toEqual([]);
  });

  it("draws eight and says in Spanish how many it dropped when the selection is wider", () => {
    // 4 accounts × 4 centers would be 16 series; the palette has eight slots.
    const codes = [...MANOR.valuesByCode.keys()].slice(0, 4);
    const selection = makeSelection({
      dimension: "cuentas",
      codes,
      cross: "centros",
      centerIds: ["consolidado", "cultura-manor", "centro-de-costo-principal"],
    });
    const bundle = buildSeries(SOURCES, toSeriesQuery(selection, makeContext()));

    expect(bundle.series).toHaveLength(CHART_MAX_SERIES);
    expect(bundle.truncated).toBe(4);
    expect(bundle.warnings[0]).toContain("se descartaron 4");
  });
});

describe("el selector se llena con datos reales", () => {
  it("lists the accounts of the active center for the cuentas dimension", () => {
    const options = entryOptionsFor("cuentas", makeContext());

    expect(options[0]).toEqual({ id: "4", label: "Ingresos", hint: "4" });
    expect(options.map((option) => option.id)).toContain(HABITACIONES);
  });

  it("lists only what the active center reports", () => {
    const options = entryOptionsFor(
      "cuentas",
      makeContext({ activeCenterId: "centro-de-costo-principal" }),
    );

    expect(options.map((option) => option.id)).not.toContain(LAVANDERIA);
  });

  it("lists the workspace centers, Consolidado included", () => {
    expect(entryOptionsFor("centros", makeContext())).toEqual([
      { id: "consolidado", label: "Consolidado" },
      { id: "cultura-manor", label: "Cultura Manor" },
      { id: "centro-de-costo-principal", label: "Centro de Costo Principal" },
    ]);
  });

  it("lists the periods of the current frequency", () => {
    expect(entryOptionsFor("periodos", makeContext({ frequency: "trimestral" }))).toHaveLength(4);
    expect(entryOptionsFor("periodos", makeContext())[0].label).toBe("Ene");
  });

  it("offers nothing at all with no data loaded", () => {
    const empty = makeContext({ sources: [], activeCenterId: "consolidado" });

    expect(entryOptionsFor("cuentas", empty)).toEqual([]);
    expect(entryOptionsFor("centros", empty)).toEqual([]);
  });
});

describe("agregar y quitar series", () => {
  it("keeps the picked accounts in file order, not in click order", () => {
    const start = makeSelection({ dimension: "cuentas" });
    const context = makeContext();
    const picked = withEntryToggled(
      withEntryToggled(start, RESTAURANTE, context),
      HABITACIONES,
      context,
    );

    // Habitaciones precedes Restaurante in the chart of accounts, clicks notwithstanding.
    expect(picked.codes).toEqual([HABITACIONES, RESTAURANTE]);
  });

  it("removes an entry that was already picked", () => {
    const context = makeContext();
    const picked = withEntryToggled(
      makeSelection({ dimension: "centros", centerIds: ["cultura-manor"] }),
      "cultura-manor",
      context,
    );

    expect(picked.centerIds).toEqual([]);
    expect(selectedIdsFor(picked, "centros").size).toBe(0);
  });

  it("starts a new dimension empty and drops the cross", () => {
    const switched = withDimension(
      makeSelection({ dimension: "cuentas", codes: [HABITACIONES], cross: "centros" }),
      "centros",
    );

    expect(switched).toMatchObject({ dimension: "centros", cross: "nada", codes: [] });
  });

  it("splits by every center when the cross is centros", () => {
    const crossed = withCross(
      makeSelection({ dimension: "cuentas", codes: [HABITACIONES] }),
      "centros",
      makeContext(),
    );

    expect(crossed.cross).toBe("centros");
    expect(crossed.centerIds).toEqual([
      "consolidado",
      "cultura-manor",
      "centro-de-costo-principal",
    ]);
  });
});

describe("resolución de color", () => {
  it("follows the center's order in the selector, not the result's", () => {
    const selection = makeSelection({
      dimension: "centros",
      centerIds: ["cultura-manor", "centro-de-costo-principal"],
    });
    const color = colorResolver(selection, makeContext());

    // The Consolidado is slot 1 of the selector even though it is not drawn here.
    expect(color({ code: HABITACIONES, centerId: "consolidado", year: 2026 })).toBe(
      CHART_PALETTE[0],
    );
    expect(color({ code: HABITACIONES, centerId: "cultura-manor", year: 2026 })).toBe(
      CHART_PALETTE[1],
    );
    expect(color({ code: HABITACIONES, centerId: "centro-de-costo-principal", year: 2026 })).toBe(
      CHART_PALETTE[2],
    );
  });

  it("does not repaint the remaining centers when one leaves the selection", () => {
    const three = makeSelection({
      dimension: "centros",
      centerIds: ["consolidado", "cultura-manor", "centro-de-costo-principal"],
    });
    const two = makeSelection({
      dimension: "centros",
      centerIds: ["cultura-manor", "centro-de-costo-principal"],
    });
    const key = { code: HABITACIONES, centerId: "centro-de-costo-principal", year: 2026 };

    expect(colorResolver(two, makeContext())(key)).toBe(colorResolver(three, makeContext())(key));
  });

  it("gives each compared account its own slot, in the order the query names them", () => {
    const selection = makeSelection({ dimension: "cuentas", codes: [HABITACIONES, RESTAURANTE] });
    const color = colorResolver(selection, makeContext());

    expect(color({ code: HABITACIONES, centerId: "cultura-manor", year: 2026 })).toBe(
      CHART_PALETTE[0],
    );
    expect(color({ code: RESTAURANTE, centerId: "cultura-manor", year: 2026 })).toBe(
      CHART_PALETTE[1],
    );
  });

  it("keeps a center on the same color across two cards of the same tab", () => {
    // Two cards, two different selections; the center's slot comes from the selector either way.
    const evolution = makeSelection({
      dimension: "centros",
      centerIds: ["cultura-manor", "centro-de-costo-principal"],
    });
    const composition = makeSelection({
      dimension: "centros",
      centerIds: ["centro-de-costo-principal"],
    });
    const key = { code: HABITACIONES, centerId: "centro-de-costo-principal", year: 2026 };

    expect(colorResolver(composition, makeContext())(key)).toBe(
      colorResolver(evolution, makeContext())(key),
    );
  });

  it("colors a preset's own codes rather than the whole chart of accounts", () => {
    // "5" sits far down the file; against the full account list it would land past the eighth
    // slot and come out neutral, which is why the universe is what the query names.
    const color = codeColorResolver(["4", "5"]);

    expect(color({ code: "4", centerId: "cultura-manor", year: 2026 })).toBe(CHART_PALETTE[0]);
    expect(color({ code: "5", centerId: "cultura-manor", year: 2026 })).toBe(CHART_PALETTE[1]);
  });

  it("gives a ninth entity the neutral rather than a generated color", () => {
    const codes = [...MANOR.valuesByCode.keys()].slice(0, 12);
    const selection = makeSelection({ dimension: "cuentas", codes });
    const color = colorResolver(selection, makeContext());

    expect(color({ code: codes[8], centerId: "cultura-manor", year: 2026 })).toBe(CHART_NEUTRAL);
  });
});
