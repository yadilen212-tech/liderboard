import { describe, expect, it } from "vitest";
import { makeSeries } from "./fixtures";
import type { ComparisonBase, Series, SeriesBundle } from "./types";
import { compareSeries } from "./variation";

function bundleOf(series: Series[]): SeriesBundle {
  return {
    series,
    periods: series[0]?.points.map((point) => point.period) ?? [],
    truncated: 0,
    warnings: [],
  };
}

describe("compareSeries", () => {
  it("compares against the previous period", () => {
    const points = compareSeries(makeSeries([100, 150]), { kind: "periodo-anterior" });
    expect(points[1].baseValue).toBe(100);
    expect(points[1].deltaAbs).toBe(50);
    expect(points[1].deltaPct).toBe(50);
  });

  it("leaves the first period without a base", () => {
    const [first] = compareSeries(makeSeries([100, 150]), { kind: "periodo-anterior" });
    expect(first.baseValue).toBeNull();
    expect(first.deltaAbs).toBeNull();
    expect(first.deltaPct).toBeNull();
  });

  it("reads a growing discount as negative, not as growth", () => {
    // 4.1.4 Descuentos sobre Ventas: −32 → −475. Dividing by the SIGNED base would say +1.384%.
    const points = compareSeries(makeSeries([-32, -475]), { kind: "periodo-anterior" });
    expect(points[1].deltaAbs).toBe(-443);
    expect(points[1].deltaPct ?? 0).toBeCloseTo(-1384.375, 3);
  });

  it("returns a null percentage when the base is zero, but keeps the absolute delta", () => {
    const points = compareSeries(makeSeries([0, 500]), { kind: "periodo-anterior" });
    expect(points[1].deltaAbs).toBe(500);
    expect(points[1].deltaPct).toBeNull();
  });

  it("compares against the first covered period", () => {
    const points = compareSeries(makeSeries([null, 200, 250]), { kind: "primer-periodo" });
    expect(points[1].baseValue).toBe(200);
    expect(points[2].baseValue).toBe(200);
    expect(points[2].deltaPct).toBe(25);
    expect(points[0].baseValue).toBe(200);
    expect(points[0].deltaAbs).toBeNull();
  });

  it("compares against the average of the covered periods", () => {
    const points = compareSeries(makeSeries([100, 200, 300, null]), { kind: "promedio" });
    expect(points.every((point) => point.baseValue === 200 || point.value === null)).toBe(true);
    expect(points[0].deltaAbs).toBe(-100);
    expect(points[2].deltaPct).toBe(50);
  });

  it("compares against the same period of the previous year", () => {
    const current = makeSeries([100, 200], { year: 2026 });
    const previous = makeSeries([80, 400], { year: 2025 });
    const points = compareSeries(
      current,
      { kind: "mismo-periodo-anio-anterior" },
      { bundle: bundleOf([current, previous]) },
    );
    expect(points.map((point) => point.baseValue).slice(0, 2)).toEqual([80, 400]);
    expect(points[0].deltaPct).toBe(25);
    expect(points[1].deltaPct).toBe(-50);
  });

  it("compares against another series of the bundle", () => {
    const manor = makeSeries([100, 200], { centerId: "cultura-manor" });
    const principal = makeSeries([50, 50], { centerId: "centro-de-costo-principal" });
    const points = compareSeries(
      manor,
      { kind: "serie", key: principal.key },
      { bundle: bundleOf([manor, principal]) },
    );
    expect(points.map((point) => point.baseValue).slice(0, 2)).toEqual([50, 50]);
    expect(points[1].deltaAbs).toBe(150);
    expect(points[1].deltaPct).toBe(300);
  });

  it("has no base when the referenced series is not in the bundle", () => {
    const manor = makeSeries([100, 200]);
    const points = compareSeries(
      manor,
      { kind: "serie", key: { code: "4.1.1.2", centerId: "otro", year: 2026 } },
      { bundle: bundleOf([manor]) },
    );
    expect(points.every((point) => point.baseValue === null)).toBe(true);
  });

  it("has no base when no context is given for a base that needs one", () => {
    const points = compareSeries(makeSeries([100, 200]), { kind: "mismo-periodo-anio-anterior" });
    expect(points.every((point) => point.baseValue === null)).toBe(true);
  });

  it("keeps the period of every point", () => {
    const series = makeSeries([100, 150]);
    const points = compareSeries(series, { kind: "periodo-anterior" });
    expect(points.map((point) => point.period)).toEqual(series.points.map((p) => p.period));
    expect(points.map((point) => point.value)).toEqual(series.points.map((p) => p.value));
  });

  it("never produces Infinity nor NaN with any base", () => {
    const zeroed = makeSeries([0, 500, null, 0], { year: 2026 });
    const previousYear = makeSeries([0, 0, 0, 0], { year: 2025 });
    const bases: ComparisonBase[] = [
      { kind: "periodo-anterior" },
      { kind: "primer-periodo" },
      { kind: "promedio" },
      { kind: "mismo-periodo-anio-anterior" },
      { kind: "serie", key: previousYear.key },
    ];
    for (const base of bases) {
      const points = compareSeries(zeroed, base, { bundle: bundleOf([zeroed, previousYear]) });
      for (const point of points) {
        expect(point.deltaPct === null || Number.isFinite(point.deltaPct)).toBe(true);
        expect(point.deltaAbs === null || Number.isFinite(point.deltaAbs)).toBe(true);
      }
    }
  });
});
