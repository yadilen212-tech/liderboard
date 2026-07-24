import { describe, expect, it } from "vitest";
import { makeSeries } from "./fixtures";
import { toIndex100, toMovingAverage, toPreviousYear, toYtd } from "./temporal";
import type { Series, SeriesBundle } from "./types";

function values(series: Series): (number | null)[] {
  return series.points.map((point) => point.value);
}

/** Fills a partial year up to twelve months, the rest uncovered. */
function year(...covered: (number | null)[]): (number | null)[] {
  return Array.from({ length: 12 }, (_, month) => covered[month] ?? null);
}

/** A series that runs across two years, which is what makes the YTD reset observable. */
function acrossYears(previous: (number | null)[], current: (number | null)[]): Series {
  const first = makeSeries(previous, { year: 2025 });
  const second = makeSeries(current, { year: 2026 });
  return { ...second, points: [...first.points, ...second.points] };
}

function bundleOf(series: Series[]): SeriesBundle {
  return {
    series,
    periods: series[0]?.points.map((p) => p.period) ?? [],
    truncated: 0,
    warnings: [],
  };
}

describe("las transformaciones son puras", () => {
  it("does not mutate its input", () => {
    const series = makeSeries([100, 50, 75]);
    const snapshot = values(series);
    toYtd(series);
    toIndex100(series);
    toMovingAverage(series);
    expect(values(series)).toEqual(snapshot);
    expect(toYtd(series)).not.toBe(series);
    expect(toYtd(series).points[0]).not.toBe(series.points[0]);
  });

  it("propagates the nulls of an uncovered period", () => {
    const series = makeSeries([100, 50, null, 75]);
    for (const transformed of [toYtd(series), toIndex100(series), toMovingAverage(series, 2)]) {
      expect(transformed.points[2].value).toBeNull();
    }
  });

  it("keeps the key and the container when transformations are chained", () => {
    const series = makeSeries([100, 50, 75], { container: [200, 100, 150] });
    const chained = toIndex100(toYtd(series));
    expect(chained.key).toEqual(series.key);
    expect(chained.container).toEqual(series.container);
  });
});

describe("toYtd", () => {
  it("accumulates within the year", () => {
    expect(values(toYtd(makeSeries([100, 50, 75]))).slice(0, 3)).toEqual([100, 150, 225]);
  });

  it("leaves uncovered periods null without touching the accumulator", () => {
    const series = makeSeries([100, 50, null, null, 30]);
    expect(values(toYtd(series)).slice(0, 5)).toEqual([100, 150, null, null, 180]);
  });

  it("restarts the accumulator on a new year", () => {
    const series = acrossYears(year(10, 20, 30), year(7, 5));
    const result = values(toYtd(series));
    expect(result.slice(0, 3)).toEqual([10, 30, 60]);
    // January 2026 is its own value, not the continuation of December 2025.
    expect(result[12]).toBe(7);
    expect(result[13]).toBe(12);
  });
});

describe("toIndex100", () => {
  it("re-expresses every point against the first covered one", () => {
    expect(values(toIndex100(makeSeries([200, 250, 150]))).slice(0, 3)).toEqual([100, 125, 75]);
  });

  it("takes the base from an explicit period when one is given", () => {
    const series = makeSeries([200, 250, 150]);
    const indexed = toIndex100(series, { year: 2026, frequency: "mensual", index: 1 });
    expect(values(indexed).slice(0, 3)).toEqual([80, 100, 60]);
  });

  it("skips the uncovered periods when picking the base", () => {
    const indexed = toIndex100(makeSeries([null, null, 400, 500]));
    expect(values(indexed).slice(0, 4)).toEqual([null, null, 100, 125]);
  });

  it("blanks the whole series and warns when the base is zero", () => {
    const indexed = toIndex100(makeSeries([0, 250, 150]));
    expect(values(indexed).every((value) => value === null)).toBe(true);
    expect(indexed.warnings?.[0]).toMatch(/base/i);
  });

  it("never produces Infinity nor NaN", () => {
    for (const series of [makeSeries([0, 250]), makeSeries([null, null])]) {
      for (const value of values(toIndex100(series))) {
        expect(Number.isFinite(value ?? 0)).toBe(true);
      }
    }
  });

  it("makes accounts of very different magnitude comparable", () => {
    const habitaciones = toIndex100(makeSeries([17338, 20805, 15604]));
    const lavanderia = toIndex100(makeSeries([327, 392, 294]));
    expect(habitaciones.points[0].value).toBe(100);
    expect(lavanderia.points[0].value).toBe(100);
    expect(habitaciones.points[1].value ?? 0).toBeCloseTo(120, 0);
    expect(lavanderia.points[1].value ?? 0).toBeCloseTo(120, 0);
  });
});

describe("toMovingAverage", () => {
  it("averages the last full window", () => {
    expect(values(toMovingAverage(makeSeries([30, 60, 90, 120]))).slice(0, 4)).toEqual([
      null,
      null,
      60,
      90,
    ]);
  });

  it("returns null while the window is not full", () => {
    const series = makeSeries(year(30, 60));
    expect(values(toMovingAverage(series)).every((value) => value === null)).toBe(true);
  });

  it("does not average across the holes nor drag the last covered value", () => {
    const series = makeSeries(year(30, 60, 90, 120, 150, 180, 210));
    const averaged = values(toMovingAverage(series));
    expect(averaged.slice(7)).toEqual([null, null, null, null, null]);
    expect(averaged[6]).toBe(180);
  });

  it("honours a wider window", () => {
    expect(values(toMovingAverage(makeSeries([30, 60, 90, 120]), 4))[3]).toBe(75);
  });
});

describe("toPreviousYear", () => {
  const current = makeSeries([100, 200, 300], { year: 2026 });
  const previous = makeSeries([10, 20, 30], { year: 2025 });

  it("takes the value of the same month a year earlier", () => {
    const aligned = toPreviousYear(current, bundleOf([current, previous]));
    expect(values(aligned).slice(0, 3)).toEqual([10, 20, 30]);
    expect(aligned.key).toEqual(current.key);
  });

  it("returns everything null when the bundle has no previous year", () => {
    const aligned = toPreviousYear(current, bundleOf([current]));
    expect(values(aligned).every((value) => value === null)).toBe(true);
  });

  it("matches quarter with quarter, never with a month", () => {
    const q2026 = makeSeries([100, 200, 300, 400], { year: 2026, frequency: "trimestral" });
    const q2025 = makeSeries([11, 22, 33, 44], { year: 2025, frequency: "trimestral" });
    const monthly2025 = makeSeries([9, 9, 9], { year: 2025 });
    const aligned = toPreviousYear(q2026, bundleOf([q2026, q2025, monthly2025]));
    expect(values(aligned)).toEqual([11, 22, 33, 44]);
  });

  it("ignores a previous year of another center", () => {
    const other = makeSeries([10, 20, 30], { year: 2025, centerId: "centro-de-costo-principal" });
    const aligned = toPreviousYear(current, bundleOf([current, other]));
    expect(values(aligned).every((value) => value === null)).toBe(true);
  });
});
