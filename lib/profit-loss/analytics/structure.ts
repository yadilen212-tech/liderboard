/**
 * Structure-family transformations: what share of the whole an account represents. The two
 * percentage functions keep the series shape (`key` and `container` preserved, nulls
 * propagated); the two composition functions turn a set of accounts of one period into the
 * data a Pareto curve or a pie needs — including the rules that would otherwise break them.
 */
import { aggregate } from "../derive";
import { periodsAlign } from "./period";
import { aggregateCoverage, canReexpress } from "./source";
import { blankPoints, type AnalyticsSource, type Series } from "./types";

/** The income root; every vertical analysis divides by it. */
const REVENUE_ROOT = "4";

/**
 * Divides each point by the revenue of ITS OWN source. Used over one source this is vertical
 * analysis; used over several it normalizes centers whose sizes are ~100× apart, because each
 * one is measured against its own revenue instead of against the consolidated total.
 */
export function toPctOfRevenue(series: Series, sources: AnalyticsSource[]): Series {
  const frequency = series.points[0]?.period.frequency;
  const source = sources.find(
    (candidate) => candidate.centerId === series.key.centerId && candidate.year === series.key.year,
  );
  if (!source || !frequency || !canReexpress(source.baseFrequency, frequency)) {
    return { ...series, points: blankPoints(series.points) };
  }

  const revenue = aggregate(
    source.valuesByCode.get(REVENUE_ROOT) ?? [],
    source.baseFrequency,
    frequency,
  );
  const coverage = aggregateCoverage(source.coverage, source.baseFrequency, frequency);

  return {
    ...series,
    points: series.points.map((point) => {
      const total = coverage.has(point.period.index) ? (revenue[point.period.index] ?? null) : null;
      const divisible = point.value !== null && total !== null && total !== 0;
      return { ...point, value: divisible ? ((point.value as number) / total) * 100 : null };
    }),
  };
}

/**
 * Divides each point by its container — the parent `buildSeries` already rolled up. This is
 * the basis of the 100% stacked bars, and the reason no view has to re-add the siblings.
 */
export function toPctOfContainer(series: Series): Series {
  const container = series.container;
  if (!container) {
    return { ...series, points: blankPoints(series.points) };
  }

  return {
    ...series,
    points: series.points.map((point) => {
      const match = container.points.find(
        (candidate) =>
          candidate.period.year === point.period.year &&
          periodsAlign(candidate.period, point.period),
      );
      const total = match?.value ?? null;
      const divisible = point.value !== null && total !== null && total !== 0;
      return { ...point, value: divisible ? ((point.value as number) / total) * 100 : null };
    }),
  };
}

/** One account's amount in one period — what the composition functions consume. */
export interface AmountEntry {
  code: string;
  label: string;
  value: number;
}

export interface ParetoEntry extends AmountEntry {
  pct: number;
  cumulativePct: number;
}

export interface ParetoResult {
  entries: ParetoEntry[];
  excluded: AmountEntry[];
  total: number;
}

/**
 * Sorts from largest to smallest and accumulates the share of the total, so "which accounts
 * make up 80% of the spend" is a read and not a calculation. Entries at or below zero are set
 * aside: a running total over mixed signs has no reading.
 */
export function toPareto(entries: AmountEntry[]): ParetoResult {
  const included = entries.filter((entry) => entry.value > 0);
  const excluded = entries.filter((entry) => entry.value <= 0);
  const total = included.reduce((sum, entry) => sum + entry.value, 0);

  let running = 0;
  const ranked = [...included]
    .sort((a, b) => b.value - a.value)
    .map((entry) => {
      running += entry.value;
      return {
        ...entry,
        pct: (entry.value / total) * 100,
        cumulativePct: (running / total) * 100,
      };
    });

  // `total` is only zero when nothing was included, so the divisions above never happen then.
  return { entries: total === 0 ? [] : ranked, excluded, total };
}

export interface PieSlice extends AmountEntry {
  pct: number;
}

export interface ExcludedSlice extends AmountEntry {
  reason: "negativo" | "cero";
}

export interface PieResult {
  slices: PieSlice[];
  excluded: ExcludedSlice[];
  total: number;
}

export interface PieOptions {
  /** Slices to draw, "Otros" included. Default 6. */
  maxSlices?: number;
}

const OTHERS_CODE = "otros";

/**
 * The two rules a pie breaks without: group the tail into «Otros», and drop the entries that
 * are not positive — `4.1.4 Rebajas y/o Descuentos` is negative and would draw a negative
 * angle. The excluded ones come back with their reason so the view can footnote them instead
 * of making them disappear.
 */
export function toPieSlices(entries: AmountEntry[], options: PieOptions = {}): PieResult {
  const maxSlices = options.maxSlices ?? 6;

  const excluded: ExcludedSlice[] = entries
    .filter((entry) => entry.value <= 0)
    .map((entry) => ({ ...entry, reason: entry.value < 0 ? "negativo" : "cero" }));
  const included = [...entries.filter((entry) => entry.value > 0)].sort(
    (a, b) => b.value - a.value,
  );
  const total = included.reduce((sum, entry) => sum + entry.value, 0);
  if (total === 0) {
    return { slices: [], excluded, total: 0 };
  }

  const kept =
    included.length > maxSlices
      ? [
          ...included.slice(0, maxSlices - 1),
          {
            code: OTHERS_CODE,
            label: "Otros",
            value: included.slice(maxSlices - 1).reduce((sum, entry) => sum + entry.value, 0),
          },
        ]
      : included;

  return {
    slices: kept.map((entry) => ({ ...entry, pct: (entry.value / total) * 100 })),
    excluded,
    total,
  };
}
