/**
 * Variation of a series against an eligible base. The one rule that matters here: `deltaPct`
 * divides by the ABSOLUTE value of the base. With `4.1.4 Descuentos sobre Ventas` going from
 * −32 to −475, dividing by the signed base reads as +1.384% growth when the discount actually
 * multiplied by fourteen. And it is never `Infinity` nor `NaN` — that is the kind of value
 * that propagates silently until it breaks an axis.
 */
import { periodsAlign } from "./period";
import { toPreviousYear } from "./temporal";
import {
  seriesKeyId,
  type ComparisonBase,
  type Series,
  type SeriesBundle,
  type VariationPoint,
} from "./types";

export interface ComparisonContext {
  /** Needed by the bases that read another series: the previous year and an explicit key. */
  bundle?: SeriesBundle;
}

export function compareSeries(
  series: Series,
  base: ComparisonBase,
  context: ComparisonContext = {},
): VariationPoint[] {
  const baseValues = baseValuesFor(series, base, context);

  return series.points.map((point, index) => {
    const value = point.value;
    const baseValue = baseValues[index] ?? null;
    const deltaAbs = value === null || baseValue === null ? null : value - baseValue;
    const deltaPct =
      deltaAbs === null || baseValue === null || baseValue === 0
        ? null
        : (deltaAbs / Math.abs(baseValue)) * 100;
    return { period: point.period, value, baseValue, deltaAbs, deltaPct };
  });
}

/** The base value each period is measured against, index-aligned with `series.points`. */
function baseValuesFor(
  series: Series,
  base: ComparisonBase,
  context: ComparisonContext,
): (number | null)[] {
  const none = series.points.map(() => null);

  switch (base.kind) {
    case "periodo-anterior":
      return series.points.map((_, index) => (index === 0 ? null : series.points[index - 1].value));

    case "primer-periodo": {
      const first = series.points.find((point) => point.value !== null)?.value ?? null;
      return series.points.map(() => first);
    }

    case "promedio": {
      const covered = series.points
        .map((point) => point.value)
        .filter((value): value is number => value !== null);
      const mean = covered.length
        ? covered.reduce((sum, value) => sum + value, 0) / covered.length
        : null;
      return series.points.map(() => mean);
    }

    case "mismo-periodo-anio-anterior":
      return context.bundle
        ? toPreviousYear(series, context.bundle).points.map((point) => point.value)
        : none;

    case "serie": {
      const target = seriesKeyId(base.key);
      const other = context.bundle?.series.find(
        (candidate) => seriesKeyId(candidate.key) === target,
      );
      if (!other) {
        return none;
      }
      return series.points.map(
        (point) =>
          other.points.find((candidate) => periodsAlign(candidate.period, point.period))?.value ??
          null,
      );
    }

    default:
      return none;
  }
}
