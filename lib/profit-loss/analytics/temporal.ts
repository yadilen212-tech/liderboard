/**
 * Time-family transformations: every one takes a series and returns a new one, preserving
 * `key` and `container` and never mutating the input, so the caller composes them in whatever
 * order the view needs. A `null` point stays `null` everywhere — treating it as 0 is exactly
 * the lie the coverage model exists to prevent.
 */
import { periodsAlign } from "./period";
import { blankPoints, type PeriodRef, type Series, type SeriesBundle } from "./types";

/** Accumulates within each year, restarting when the year changes. */
export function toYtd(series: Series): Series {
  let currentYear: number | null = null;
  let running = 0;

  const points = series.points.map((point) => {
    if (point.period.year !== currentYear) {
      currentYear = point.period.year;
      running = 0;
    }
    if (point.value === null) {
      // An uncovered period is not a zero: it must not move the accumulator either.
      return { ...point, value: null };
    }
    running += point.value;
    return { ...point, value: running };
  });

  return { ...series, points };
}

/**
 * Re-expresses the series against a base of 100, which is what makes a $17k account and a
 * $300 one readable on the same axis. The base defaults to the first COVERED point.
 */
export function toIndex100(series: Series, base?: PeriodRef): Series {
  const basePoint = base
    ? series.points.find(
        (point) => point.period.year === base.year && periodsAlign(point.period, base),
      )
    : series.points.find((point) => point.value !== null);
  const baseValue = basePoint?.value ?? null;

  if (baseValue === null || baseValue === 0) {
    return {
      ...series,
      points: blankPoints(series.points),
      warnings: [
        ...(series.warnings ?? []),
        `La serie «${series.label}» no tiene una base distinta de cero; el índice 100 no se puede calcular.`,
      ],
    };
  }

  return {
    ...series,
    points: series.points.map((point) => ({
      ...point,
      value: point.value === null ? null : (point.value / baseValue) * 100,
    })),
  };
}

/**
 * Averages the last `windowSize` COVERED points ending at each one. Uncovered points stay
 * null and never enter the window, so July's average is not dragged into August.
 */
export function toMovingAverage(series: Series, windowSize = 3): Series {
  const points = series.points.map((point, index) => {
    if (point.value === null) {
      return { ...point, value: null };
    }
    const window: number[] = [];
    for (let back = index; back >= 0 && window.length < windowSize; back--) {
      const value = series.points[back].value;
      if (value !== null) {
        window.push(value);
      }
    }
    if (window.length < windowSize) {
      return { ...point, value: null };
    }
    return { ...point, value: window.reduce((sum, value) => sum + value, 0) / windowSize };
  });

  return { ...series, points };
}

/**
 * Replaces each point with the same slot of the year before — same account, same center,
 * matched by (frequency, index) so T2 pairs with T2 and never with April.
 */
export function toPreviousYear(series: Series, bundle: SeriesBundle): Series {
  const previous = bundle.series.find(
    (candidate) =>
      candidate.key.code === series.key.code &&
      candidate.key.centerId === series.key.centerId &&
      candidate.key.year === series.key.year - 1,
  );

  if (!previous) {
    return { ...series, points: blankPoints(series.points) };
  }

  const points = series.points.map((point) => {
    const match = previous.points.find((candidate) => periodsAlign(candidate.period, point.period));
    return { ...point, value: match?.value ?? null };
  });

  return { ...series, points };
}
