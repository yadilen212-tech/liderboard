import { describe, expect, it } from "vitest";
import {
  CHART_MARK,
  CHART_MAX_SERIES,
  CHART_NEUTRAL,
  CHART_PALETTE,
  CHART_SIGN,
  colorForEntity,
} from "./palette";

const CENTERS = ["consolidado", "cultura-manor", "centro-de-costo-principal", "sin-centro"];

describe("el orden de las ranuras", () => {
  it("keeps the eight slots in the sequence that makes them separable", () => {
    expect([...CHART_PALETTE]).toEqual([
      "#2b6cb0",
      "#eb6834",
      "#1baf7a",
      "#eda100",
      "#e87ba4",
      "#008300",
      "#4a3aa7",
      "#e34948",
    ]);
    expect(CHART_MAX_SERIES).toBe(8);
  });

  it("gives the third compared entity slot 3, whatever else is on screen", () => {
    expect(colorForEntity("centro-de-costo-principal", CENTERS)).toBe("#1baf7a");
  });

  it("never reuses the sign tokens as a series color", () => {
    expect(CHART_PALETTE).not.toContain(CHART_SIGN.positive);
    expect(CHART_PALETTE).not.toContain(CHART_SIGN.negative);
  });
});

describe("el color sigue a la entidad", () => {
  it("does not repaint the rest when one is dropped from the drawn set", () => {
    // The order is the dimension's, not the result's: whoever is drawn is irrelevant.
    const before = CENTERS.map((id) => colorForEntity(id, CENTERS));
    const drawn = CENTERS.filter((id) => id !== "consolidado");
    const after = drawn.map((id) => colorForEntity(id, CENTERS));
    expect(after).toEqual(before.slice(1));
  });

  it("returns the same color for the same entity across calls", () => {
    expect(colorForEntity("cultura-manor", CENTERS)).toBe(colorForEntity("cultura-manor", CENTERS));
  });

  it("does not follow the account's position in the result", () => {
    const order = ["4.1.1.1", "4.1.1.2", "4.1.1.3"];
    // Drawn second here, first there — the slot comes from `order` either way.
    expect(colorForEntity("4.1.1.3", order)).toBe(CHART_PALETTE[2]);
  });
});

describe("más allá de la octava ranura", () => {
  it("does not generate a ninth color", () => {
    const nine = Array.from({ length: 9 }, (_, index) => `cuenta-${index}`);
    const ninth = colorForEntity("cuenta-8", nine);
    expect(ninth).toBe(CHART_NEUTRAL);
    expect(CHART_PALETTE).not.toContain(ninth);
  });

  it("does not cycle back to the first slot", () => {
    const ten = Array.from({ length: 10 }, (_, index) => `cuenta-${index}`);
    expect(colorForEntity("cuenta-8", ten)).not.toBe(CHART_PALETTE[0]);
    expect(colorForEntity("cuenta-9", ten)).toBe(colorForEntity("cuenta-8", ten));
  });

  it("falls back to the neutral for an entity the dimension does not contain", () => {
    expect(colorForEntity("desconocido", CENTERS)).toBe(CHART_NEUTRAL);
  });
});

describe("constantes de marca", () => {
  it("exposes the 2px separation the option builders paint between fills", () => {
    expect(CHART_MARK.gap).toBe(2);
  });
});
