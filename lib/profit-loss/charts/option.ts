/**
 * `Series[]` (or the engine's composition results) in, an ECharts option out. Every builder is
 * pure, so the rules that make a chart honest are testable without mounting a DOM:
 *
 * - A `null` point stays `null`. ECharts draws no mark for it and, with `connectNulls` off by
 *   default, no line crosses it either. Turning it into 0 would draw a collapse the file never
 *   recorded — the trap the whole coverage model exists to avoid.
 * - No builder returns two `yAxis`. The type forbids it (`ChartOption.yAxis` is one object),
 *   and the combo shares its single scale because bars and line are in the same unit.
 * - No builder writes a hex. Colors come from `colorOf`, strokes and ink from `lib/charts`.
 * - Amounts go through `formatCurrency` and periods through the engine's `periodLabel`; neither
 *   is re-implemented here.
 */
import {
  CHART_FONT,
  CHART_INK,
  CHART_LINES,
  CHART_MARK,
  CHART_SIGN,
  CHART_SURFACE,
} from "@/lib/charts/palette";
import type {
  ChartAxis,
  ChartLabel,
  ChartLegend,
  ChartOption,
  ChartParam,
  ChartSeries,
  ChartTooltip,
} from "@/lib/charts/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { periodLabel } from "../analytics/period";
import {
  toPctOfContainer,
  type AmountEntry,
  type ParetoResult,
  type PieResult,
} from "../analytics/structure";
import { seriesKeyId, type PeriodRef, type Series, type SeriesKey } from "../analytics/types";
import type { ChartType } from "./selection";

/** What the Y values mean, which is all that changes between amounts, shares and indexes. */
export type ChartUnit = "moneda" | "porcentaje" | "indice";

/** Beyond four series a number per point stops being read and starts being texture. */
const MAX_DIRECT_LABELS = 4;

/** Below two series there is nothing to tell apart, so the title carries the name. */
const MIN_LEGEND_SERIES = 2;

/** Charts whose X axis is the period. */
export interface SeriesOptionContext {
  /** The only way a series gets a color; comes from `colorResolver`. */
  colorOf: (key: SeriesKey) => string;
  periods: PeriodRef[];
  /** Adds the year to the period labels; only when the query spans several. */
  multiYear?: boolean;
  unit?: ChartUnit;
}

/** Charts whose axis is a set of accounts within one period. */
export interface EntryOptionContext {
  colorOf: (code: string) => string;
  unit?: ChartUnit;
}

/** The single value formatter every axis, label and tooltip goes through. */
export function formatChartValue(value: number, unit: ChartUnit = "moneda"): string {
  switch (unit) {
    case "porcentaje":
      return formatPercent(value);
    case "indice":
      return formatNumber(Math.round(value * 10) / 10);
    default:
      return formatCurrency(value);
  }
}

/** Vertical bars — one series is an evolution, several are a grouped comparison. */
export function barOption(series: Series[], context: SeriesOptionContext): ChartOption {
  return {
    ...chrome(series.length),
    xAxis: periodAxis(context),
    yAxis: valueAxis(context.unit),
    tooltip: axisTooltip("shadow", context.unit),
    series: series.map((entry) => barSeries(entry, series.length, context)),
  };
}

/** Stacked bars — what a total is made of, period by period. */
export function stackedOption(series: Series[], context: SeriesOptionContext): ChartOption {
  return {
    ...chrome(series.length),
    xAxis: periodAxis(context),
    yAxis: valueAxis(context.unit),
    tooltip: axisTooltip("shadow", context.unit),
    series: series.map((entry) => ({
      ...barSeries(entry, series.length, context, { stacked: true }),
      stack: "total",
    })),
  };
}

/**
 * 100% stacked bars. The percentages come from `toPctOfContainer` — each account against the
 * parent the engine rolled up — and NOT from re-adding the visible series. Picking 3 of a
 * parent's 8 children therefore draws three shares that correctly fall short of 100.
 */
export function hundredPercentOption(series: Series[], context: SeriesOptionContext): ChartOption {
  const shares = hundredPercentSeries(series);
  return {
    ...chrome(shares.length),
    xAxis: periodAxis(context),
    yAxis: { ...valueAxis("porcentaje"), max: 100 },
    tooltip: axisTooltip("shadow", "porcentaje"),
    series: shares.map((entry) => ({
      ...barSeries(entry, shares.length, { ...context, unit: "porcentaje" }, { stacked: true }),
      stack: "total",
    })),
  };
}

/**
 * The shares a 100% stack draws. Exported so the card's table twin reads the SAME numbers as
 * the chart — the table has to show the transformed values, not the amounts behind them.
 */
export function hundredPercentSeries(series: Series[]): Series[] {
  return series.map(toPctOfContainer);
}

/** Lines — trends and, above all, índice base 100, where the shapes are what compare. */
export function lineOption(series: Series[], context: SeriesOptionContext): ChartOption {
  return {
    ...chrome(series.length),
    xAxis: periodAxis(context),
    yAxis: valueAxis(context.unit),
    tooltip: axisTooltip("cross", context.unit),
    series: series.map((entry) => lineSeries(entry, series.length, context)),
  };
}

/**
 * Bars with a line on top, sharing ONE axis and one unit: the amount with its moving average,
 * or with the same period a year earlier. The overlay takes an ink tone rather than a palette
 * slot, because it is a reading of the same entity and not a second one.
 */
export function comboOption(
  bars: Series,
  overlay: Series,
  overlayLabel: string,
  context: SeriesOptionContext,
): ChartOption {
  return {
    ...chrome(MIN_LEGEND_SERIES),
    xAxis: periodAxis(context),
    yAxis: valueAxis(context.unit),
    tooltip: axisTooltip("cross", context.unit),
    series: [
      barSeries(bars, 1, context),
      {
        id: `${seriesKeyId(overlay.key)}|overlay`,
        type: "line",
        name: overlayLabel,
        data: overlay.points.map((point) => point.value),
        lineStyle: { color: CHART_INK.strong, width: CHART_MARK.lineWidth, type: "solid" },
        itemStyle: { color: CHART_INK.strong },
        symbol: "circle",
        symbolSize: CHART_MARK.symbolSize,
        smooth: false,
        label: { show: false },
        z: 3,
      },
    ],
  };
}

/**
 * Horizontal bars ordered largest first — the ranking of a period, and the shape
 * `toPctOfRevenue` gets so the account names have room to be read.
 */
export function horizontalBarOption(
  entries: AmountEntry[],
  context: EntryOptionContext,
): ChartOption {
  const ranked = [...entries].sort((a, b) => b.value - a.value);
  const unit = context.unit;

  return {
    ...chrome(1),
    grid: CATEGORY_ROW_GRID,
    xAxis: valueAxis(unit),
    yAxis: {
      ...categoryAxis(ranked.map((entry) => entry.label)),
      // Category axes run bottom-up; inverting puts the largest bar on the first row.
      inverse: true,
      axisLabel: ROW_AXIS_LABEL,
    },
    tooltip: axisTooltip("shadow", unit),
    series: [
      {
        id: "ranking",
        type: "bar",
        name: "Monto",
        data: ranked.map((entry) => ({
          value: entry.value,
          itemStyle: {
            color: context.colorOf(entry.code),
            borderRadius: [0, CHART_MARK.radius, CHART_MARK.radius, 0],
          },
        })),
        barMaxWidth: CHART_MARK.barMaxWidth,
        emphasis: { focus: "series" },
        label: directLabel(true, unit, "right"),
        labelLayout: { hideOverlap: true },
      },
    ],
  };
}

/** Up and down as glyphs, so the sign of a variation is never carried by color alone. */
const SIGN_MARK = { up: "▲", down: "▼" } as const;

/** The sign tokens as an entry color resolver, so a table twin matches its signed bars. */
export function signColorOf(entries: readonly AmountEntry[]): (code: string) => string {
  const byCode = new Map(entries.map((entry) => [entry.code, entry.value]));
  return (code) => ((byCode.get(code) ?? 0) < 0 ? CHART_SIGN.negative : CHART_SIGN.positive);
}

/**
 * Signed horizontal bars. `--color-positive` and `--color-negative` are the ONE place those
 * tokens appear as a fill, and they never travel alone: each bar carries an arrow and its
 * signed amount, because a reader who cannot separate the two hues still has to be able to
 * tell a rise from a fall.
 */
export function variationBarOption(
  entries: AmountEntry[],
  context: { unit?: ChartUnit } = {},
): ChartOption {
  const ranked = [...entries].sort((a, b) => b.value - a.value);

  return {
    ...chrome(1),
    grid: CATEGORY_ROW_GRID,
    xAxis: valueAxis(context.unit),
    yAxis: {
      ...categoryAxis(ranked.map((entry) => entry.label)),
      inverse: true,
      axisLabel: ROW_AXIS_LABEL,
    },
    tooltip: axisTooltip("shadow", context.unit),
    series: [
      {
        id: "variacion",
        type: "bar",
        name: "Variación",
        data: ranked.map((entry) => ({
          value: entry.value,
          itemStyle: {
            color: entry.value < 0 ? CHART_SIGN.negative : CHART_SIGN.positive,
            borderRadius: CHART_MARK.radius,
          },
        })),
        barMaxWidth: CHART_MARK.barMaxWidth,
        emphasis: { focus: "series" },
        label: {
          show: true,
          position: "right",
          color: CHART_INK.strong,
          fontSize: 10.5,
          distance: 6,
          formatter: (param) =>
            param.value === null
              ? ""
              : `${param.value < 0 ? SIGN_MARK.down : SIGN_MARK.up} ${formatChartValue(param.value, context.unit)}`,
        },
        labelLayout: { hideOverlap: true },
      },
    ],
  };
}

export interface PieOptionContext extends EntryOptionContext {
  /** A donut leaves the middle free for the total, which a pie cannot show. */
  donut?: boolean;
}

/**
 * Pie or donut, fed by `toPieSlices` — which is what groups the tail into «Otros» and drops
 * the non-positive entries. `4.1.4 Rebaja y/o Descuentos sobre Ventas` is negative and would
 * otherwise draw a negative angle; it comes back in `excluded` for the card to footnote.
 */
export function pieOption(result: PieResult, context: PieOptionContext): ChartOption {
  return {
    animationDuration: 320,
    textStyle: { fontFamily: CHART_FONT },
    tooltip: {
      trigger: "item",
      ...TOOLTIP_CHROME,
      formatter: (params) => {
        const param = (Array.isArray(params) ? params[0] : params) as ChartParam | undefined;
        if (!param || param.value === null) {
          return "";
        }
        const share = param.percent === undefined ? "" : ` · ${formatPercent(param.percent)}`;
        return `${param.name}<br/>${param.marker ?? ""} ${formatChartValue(param.value, context.unit)}${share}`;
      },
    },
    legend: legendFor(result.slices.length),
    series: [
      {
        id: "composicion",
        type: "pie",
        radius: context.donut ? ["52%", "78%"] : ["0%", "74%"],
        center: ["50%", "44%"],
        data: result.slices.map((slice) => ({
          id: slice.code,
          name: slice.label,
          value: slice.value,
          itemStyle: {
            color: context.colorOf(slice.code),
            borderColor: CHART_SURFACE,
            borderWidth: CHART_MARK.gap,
          },
        })),
        label: {
          show: true,
          position: "outside",
          color: CHART_INK.muted,
          fontSize: 11,
          formatter: (param) =>
            param.percent === undefined
              ? param.name
              : `${param.name} · ${formatPercent(param.percent)}`,
        },
        labelLayout: { hideOverlap: true },
        emphasis: { focus: "series" },
      },
    ],
  };
}

/**
 * Concentration of spend. The textbook Pareto is a double axis — bars of amount plus a line of
 * cumulative percentage — which is exactly what this change rules out. Here the cumulative
 * rides each bar as a direct label and the 80% cut is a reference line between two categories,
 * so it reads the same and invents no second scale.
 */
export function paretoOption(result: ParetoResult, context: EntryOptionContext): ChartOption {
  const cut = result.entries.findIndex((entry) => entry.cumulativePct >= 80);

  return {
    ...chrome(1),
    grid: CATEGORY_ROW_GRID,
    xAxis: valueAxis(context.unit),
    yAxis: {
      ...categoryAxis(result.entries.map((entry) => entry.label)),
      inverse: true,
      axisLabel: ROW_AXIS_LABEL,
    },
    tooltip: axisTooltip("shadow", context.unit),
    series: [
      {
        id: "pareto",
        type: "bar",
        name: "Gasto",
        data: result.entries.map((entry) => ({
          value: entry.value,
          itemStyle: {
            color: context.colorOf(entry.code),
            borderRadius: [0, CHART_MARK.radius, CHART_MARK.radius, 0],
          },
        })),
        barMaxWidth: CHART_MARK.barMaxWidth,
        emphasis: { focus: "series" },
        label: {
          show: true,
          position: "right",
          color: CHART_INK.muted,
          fontSize: 11,
          distance: 6,
          formatter: (param) => {
            const entry = result.entries[param.dataIndex];
            return entry
              ? `${formatCurrency(entry.value)} · ${formatPercent(entry.cumulativePct)}`
              : "";
          },
        },
        labelLayout: { hideOverlap: true },
        ...(cut >= 0 && cut < result.entries.length - 1
          ? {
              markLine: {
                silent: true,
                symbol: "none",
                // Half a slot below the last bar inside the 80%: the line sits between rows.
                data: [{ yAxis: cut + 0.5, name: "80 %" }],
                label: {
                  show: true,
                  position: "insideEndTop",
                  formatter: "80 % del gasto",
                  color: CHART_INK.faint,
                  fontSize: 10.5,
                },
                lineStyle: { color: CHART_INK.faint, width: 1, type: "dashed" },
              },
            }
          : {}),
      },
    ],
  };
}

/* ------------------------------------------------------------- shape dispatchers */

/**
 * The chart type the user picked, resolved to its builder. Both tabs go through this so a new
 * shape is wired once; `sanitizeSelection` has already clamped the type to one the
 * transformation admits, so the fall-through is a default and not a silent substitution.
 */
export function seriesOptionFor(
  chartType: ChartType,
  series: Series[],
  context: SeriesOptionContext,
): ChartOption {
  switch (chartType) {
    case "barras-apiladas":
      return stackedOption(series, context);
    case "barras-100":
      return hundredPercentOption(series, context);
    case "linea":
      return lineOption(series, context);
    default:
      return barOption(series, context);
  }
}

/** The table twin of the same shape — 100% stacks must show shares, not the amounts. */
export function seriesTableFor(
  chartType: ChartType,
  series: Series[],
  context: SeriesOptionContext,
): ChartTable {
  return chartType === "barras-100"
    ? seriesTable(hundredPercentSeries(series), { ...context, unit: "porcentaje" })
    : seriesTable(series, context);
}

/* -------------------------------------------------------------------- table twin */

export interface ChartTableRow {
  /** `seriesKeyId` for a series, the account code for an entry — stable across renders. */
  id: string;
  label: string;
  color: string;
  /** Already formatted; `null` is a period with no coverage and must render EMPTY, not `$0`. */
  values: (string | null)[];
}

export interface ChartTable {
  columns: string[];
  rows: ChartTableRow[];
}

/**
 * The same series as rows and the same periods as columns. Three of the eight palette slots
 * fall below 3:1 against white — unavoidable in a categorical eight — so a readable numeric
 * twin is not a nicety. It is also the only place a transformed chart's numbers exist at all:
 * índice 100, variación and YTD are nowhere in the Datos tab.
 */
export function seriesTable(series: Series[], context: SeriesOptionContext): ChartTable {
  return {
    columns: context.periods.map((period) => periodLabel(period, { multiYear: context.multiYear })),
    rows: series.map((entry) => ({
      id: seriesKeyId(entry.key),
      label: entry.label,
      color: context.colorOf(entry.key),
      values: entry.points.map((point) =>
        point.value === null ? null : formatChartValue(point.value, context.unit),
      ),
    })),
  };
}

/** The twin of an entry-based card: one row per account, one column with its amount. */
export function entryTable(
  entries: AmountEntry[],
  context: EntryOptionContext,
  valueHeader = "Monto",
): ChartTable {
  return {
    columns: [valueHeader],
    rows: [...entries]
      .sort((a, b) => b.value - a.value)
      .map((entry) => ({
        id: entry.code,
        label: entry.label,
        color: context.colorOf(entry.code),
        values: [formatChartValue(entry.value, context.unit)],
      })),
  };
}

/* ------------------------------------------------------------------ shared pieces */

/**
 * Row charts reserve their left gutter EXPLICITLY instead of letting the layout shrink to fit.
 * `outerBoundsContain: "axisLabel"` does not account for a width-capped label, so an account
 * name long enough to be truncated ended up drawn past the left edge and clipped at the START
 * — "Mantenimiento Equipos" reading as "lantenimiento Equipos". A fixed gutter wider than the
 * label cap cannot do that.
 */
const ROW_LABEL_WIDTH = 150;
const CATEGORY_ROW_GRID = {
  left: ROW_LABEL_WIDTH + 14,
  right: 84,
  top: 8,
  bottom: 8,
  outerBoundsMode: "none",
} as const;

const ROW_AXIS_LABEL = {
  color: CHART_INK.muted,
  fontSize: 11.5,
  width: ROW_LABEL_WIDTH,
  overflow: "truncate",
} as const;

const TOOLTIP_CHROME: Omit<ChartTooltip, "trigger" | "formatter"> = {
  backgroundColor: CHART_SURFACE,
  borderColor: CHART_LINES.axis,
  borderWidth: 1,
  padding: [8, 10],
  textStyle: { color: CHART_INK.strong, fontSize: 12 },
};

/** Everything a cartesian chart shares: font, animation, plot box and legend. */
function chrome(
  seriesCount: number,
): Pick<ChartOption, "animationDuration" | "textStyle" | "grid" | "legend"> {
  const legend = legendFor(seriesCount);
  return {
    animationDuration: 320,
    textStyle: { fontFamily: CHART_FONT },
    grid: {
      left: 8,
      right: 16,
      top: 16,
      bottom: legend.show ? 28 : 8,
      outerBoundsMode: "same",
      outerBoundsContain: "axisLabel",
    },
    legend,
  };
}

function legendFor(seriesCount: number): ChartLegend {
  return {
    show: seriesCount >= MIN_LEGEND_SERIES,
    type: "scroll",
    bottom: 0,
    icon: "roundRect",
    itemWidth: 10,
    itemHeight: 10,
    itemGap: 14,
    textStyle: { color: CHART_INK.muted, fontSize: 11.5 },
  };
}

function periodAxis(context: SeriesOptionContext): ChartAxis {
  return categoryAxis(
    context.periods.map((period) => periodLabel(period, { multiYear: context.multiYear })),
  );
}

function categoryAxis(labels: string[]): ChartAxis {
  return {
    type: "category",
    data: labels,
    axisLine: { show: true, lineStyle: { color: CHART_LINES.axis, width: 1, type: "solid" } },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { color: CHART_INK.muted, fontSize: 11, hideOverlap: true },
  };
}

/** One recessive tone, continuous stroke: the grid must sit behind the marks, not compete. */
function valueAxis(unit: ChartUnit = "moneda"): ChartAxis {
  return {
    type: "value",
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: true, lineStyle: { color: CHART_LINES.grid, width: 1, type: "solid" } },
    axisLabel: {
      color: CHART_INK.faint,
      fontSize: 11,
      formatter: (value) => formatChartValue(Number(value), unit),
    },
  };
}

/**
 * A tooltip that omits the series with no coverage instead of reporting `$0` for them, and
 * renders nothing at all when a period has no covered series. `axis` trigger also makes the
 * whole column sensitive, which is how the hit area ends up larger than the mark.
 */
function axisTooltip(pointer: "shadow" | "cross", unit: ChartUnit = "moneda"): ChartTooltip {
  return {
    trigger: "axis",
    axisPointer: { type: pointer, lineStyle: { color: CHART_LINES.axis, width: 1 } },
    ...TOOLTIP_CHROME,
    formatter: (params) => {
      const list = Array.isArray(params) ? params : [params];
      const covered = list.filter((param) => param.value !== null && param.value !== undefined);
      if (covered.length === 0) {
        return "";
      }
      const rows = covered.map(
        (param) =>
          `${param.marker ?? ""} ${param.seriesName ?? ""}: ${formatChartValue(param.value as number, unit)}`,
      );
      return [covered[0].name, ...rows].join("<br/>");
    },
  };
}

function barSeries(
  series: Series,
  seriesCount: number,
  context: SeriesOptionContext,
  options: { stacked?: boolean } = {},
): ChartSeries {
  const stacked = options.stacked ?? false;
  // Contiguous fills — stacked segments, grouped bars — are separated by 2px of the surface.
  const separation =
    stacked || seriesCount > 1 ? { borderColor: CHART_SURFACE, borderWidth: CHART_MARK.gap } : {};

  return {
    id: seriesKeyId(series.key),
    type: "bar",
    name: series.label,
    data: series.points.map((point) => point.value),
    itemStyle: {
      color: context.colorOf(series.key),
      borderRadius: stacked ? 0 : [CHART_MARK.radius, CHART_MARK.radius, 0, 0],
      ...separation,
    },
    barMaxWidth: CHART_MARK.barMaxWidth,
    emphasis: { focus: "series" },
    label: directLabel(seriesCount <= MAX_DIRECT_LABELS, context.unit, stacked ? "inside" : "top"),
    labelLayout: { hideOverlap: true },
  };
}

function lineSeries(
  series: Series,
  seriesCount: number,
  context: SeriesOptionContext,
): ChartSeries {
  const color = context.colorOf(series.key);
  return {
    id: seriesKeyId(series.key),
    type: "line",
    name: series.label,
    data: series.points.map((point) => point.value),
    lineStyle: { color, width: CHART_MARK.lineWidth, type: "solid" },
    itemStyle: { color },
    symbol: "circle",
    symbolSize: CHART_MARK.symbolSize,
    smooth: false,
    emphasis: { focus: "series" },
    label: directLabel(seriesCount <= MAX_DIRECT_LABELS, context.unit, "top"),
    labelLayout: { hideOverlap: true },
  };
}

/**
 * The direct label of a mark. `hideOverlap` in `labelLayout` is what drops one that does not
 * fit rather than drawing it clipped, and the empty string for a `null` keeps an uncovered
 * period from printing a value it does not have.
 */
function directLabel(
  show: boolean,
  unit: ChartUnit = "moneda",
  position: ChartLabel["position"] = "top",
): ChartLabel {
  return {
    show,
    position,
    // Ink, never the series color — an inside label sits on a saturated fill, hence `onFill`.
    color: position === "inside" ? CHART_INK.onFill : CHART_INK.strong,
    fontSize: 10.5,
    formatter: (param) =>
      param.value === null || param.value === undefined ? "" : formatChartValue(param.value, unit),
  };
}
