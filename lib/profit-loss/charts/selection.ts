/**
 * What the user picked, and the two pure functions that keep it honest: one translates it into
 * a `SeriesQuery`, the other prunes it when the ground moves under it.
 *
 * Both live here rather than in a component for the same reason the engine does: a query
 * assembled inline is a query nobody can test, and the moment two views assemble one each they
 * drift. `CompareBar`, the presets and the Análisis tab all go through `toSeriesQuery`.
 */
import { CHART_MAX_SERIES, colorForEntity } from "@/lib/charts/palette";
import { periodLabel, periodsForYear } from "../analytics/period";
import type { AnalyticsSource, PeriodRef, SeriesKey, SeriesQuery } from "../analytics/types";
import type { Frequency } from "../types";

/** The four axes `CompareBar` offers, plus the off state. */
export type CompareDimension = "nada" | "cuentas" | "centros" | "periodos" | "niveles";

/** The shapes the presentation layer can draw. One per entry of the design's form table. */
export type ChartType =
  | "barras"
  | "barras-apiladas"
  | "barras-100"
  | "barras-horizontales"
  | "pastel"
  | "dona"
  | "linea"
  | "combo"
  | "pareto"
  | "cascada";

/** The engine transformation a card applies. `montos` is the identity — the raw series. */
export type TransformId =
  | "montos"
  | "composicion"
  | "ytd"
  | "index100"
  | "media-movil"
  | "anio-anterior"
  | "pct-ingresos"
  | "pct-contenedor"
  | "variacion"
  | "pareto"
  | "cascada";

/**
 * Which shapes a transformation admits, in preference order. The head is what a view falls
 * back to; offering anything outside the list would draw a unit the shape cannot carry (a
 * percentage stacked to 100 against amounts, an index as a pie slice).
 */
export const SHAPES_BY_TRANSFORM: Record<TransformId, readonly ChartType[]> = {
  montos: ["barras", "barras-apiladas", "linea"],
  composicion: ["dona", "pastel"],
  ytd: ["barras", "linea"],
  index100: ["linea"],
  "media-movil": ["combo"],
  "anio-anterior": ["combo"],
  "pct-ingresos": ["barras-horizontales"],
  "pct-contenedor": ["barras-100"],
  variacion: ["barras"],
  pareto: ["pareto"],
  // Una cascada es una cascada: la lista de una sola entrada es lo que hace que `shapeFor`
  // devuelva siempre la misma forma y que la tarjeta no tenga selector que ofrecer.
  cascada: ["cascada"],
};

export type TransformGroup = "temporal" | "estructura" | "variacion";

/** The Análisis selector, in Spanish, grouped the way the tab presents it. */
export const ANALYSIS_TRANSFORMS: readonly {
  id: TransformId;
  label: string;
  group: TransformGroup;
}[] = [
  { id: "ytd", label: "Acumulado del año", group: "temporal" },
  { id: "index100", label: "Índice base 100", group: "temporal" },
  { id: "media-movil", label: "Media móvil (3)", group: "temporal" },
  { id: "anio-anterior", label: "Mismo periodo del año anterior", group: "temporal" },
  { id: "pct-ingresos", label: "% sobre ingresos", group: "estructura" },
  { id: "pct-contenedor", label: "% sobre la cuenta padre", group: "estructura" },
  { id: "pareto", label: "Concentración de gastos", group: "estructura" },
  { id: "variacion", label: "Variación contra el periodo anterior", group: "variacion" },
];

/**
 * Everything a chart tab lets the user decide. It is memory-only by design: it means nothing
 * without the workspace that produced it, so `workspaceKey` travels with it and a different
 * one wipes it rather than pointing at accounts that no longer exist.
 */
export interface AnalyticsSelection {
  /** Identity of the workspace this selection was built against. */
  workspaceKey: string;
  dimension: CompareDimension;
  /** "Y también por": the second axis of the cartesian product. `nada` = no cross. */
  cross: CompareDimension;
  codes: string[];
  centerIds: string[];
  /** Account depths for the `niveles` axis; each expands to every code at that depth. */
  levels: number[];
  periods: PeriodRef[];
  transform: TransformId;
  chartType: ChartType;
}

/** What the selection is read against: the filter row, the active center and the workspace. */
export interface SelectionContext {
  sources: readonly AnalyticsSource[];
  workspaceKey: string;
  activeCenterId: string;
  /** Always the "Ver por" control's — no chart carries a frequency of its own. */
  frequency: Frequency;
  year: number;
  /** "Cuenta contable" focus from the filter row; empty = no focus. */
  focusedCodes: readonly string[];
}

/** Ingresos — what a query falls back to when no account is focused and none is compared. */
export const DEFAULT_FOCUS_CODE = "4";

export function emptySelection(workspaceKey: string): AnalyticsSelection {
  return {
    workspaceKey,
    dimension: "nada",
    cross: "nada",
    codes: [],
    centerIds: [],
    levels: [],
    periods: [],
    transform: "montos",
    chartType: "barras",
  };
}

/**
 * Whether there is a comparison to DRAW. Picking a dimension is not enough — the user has yet
 * to add anything to it — so the tab keeps its preset until the axis has entries, which is also
 * how it returns to the preset when a pruning empties one.
 *
 * The chosen dimension itself survives regardless: it is what reveals the "Agregar" picker, and
 * clearing it would make the box impossible to fill.
 */
export function isComparing(selection: AnalyticsSelection): boolean {
  return selection.dimension !== "nada" && hasEntries(selection, selection.dimension);
}

/**
 * The single translation from selection to query. `limit` is the chart's cap and not the
 * engine's: past eight series the palette has no slot left, so the engine truncates and
 * reports it instead of the view inventing a ninth color.
 */
export function toSeriesQuery(
  selection: AnalyticsSelection,
  context: SelectionContext,
): SeriesQuery {
  const periods = onAxis(selection, "periodos") ? selection.periods : [];

  return {
    codes: codesFor(selection, context),
    centerIds: onAxis(selection, "centros") ? selection.centerIds : [context.activeCenterId],
    years: [context.year],
    frequency: context.frequency,
    ...(periods.length > 0 ? { periods } : {}),
    limit: CHART_MAX_SERIES,
  };
}

/**
 * Prunes what stopped existing. Loading another workspace wipes the selection outright —
 * account codes and center slugs from a different Excel would silently resolve to nothing —
 * while a center or frequency change only drops the entries that no longer resolve. An axis
 * left with no entries falls back to `nada`, which is how the tab returns to its preset
 * instead of drawing an empty plot.
 */
export function sanitizeSelection(
  selection: AnalyticsSelection,
  context: SelectionContext,
): AnalyticsSelection {
  if (selection.workspaceKey !== context.workspaceKey) {
    return emptySelection(context.workspaceKey);
  }

  const source = activeSource(context);
  const centerIds = new Set(context.sources.map((candidate) => candidate.centerId));
  const axis = periodsForYear(context.year, context.frequency);
  const depths = new Set(source ? [...source.valuesByCode.keys()].map(depthOf) : []);

  const pruned: AnalyticsSelection = {
    ...selection,
    codes: selection.codes.filter((code) => source?.valuesByCode.has(code) ?? false),
    centerIds: selection.centerIds.filter((id) => centerIds.has(id)),
    levels: selection.levels.filter((level) => depths.has(level)),
    // A period belongs to a (year, frequency); a coarser "Ver por" leaves the old ones
    // pointing at slots that no longer exist on the axis.
    periods: selection.periods.filter(
      (period) =>
        period.year === context.year &&
        period.frequency === context.frequency &&
        period.index < axis.length,
    ),
    chartType: shapeFor(selection.transform, selection.chartType),
  };

  // The dimension itself is the user's choice and survives an empty list — `isComparing` is
  // what sends the tab back to its preset. The cross does not survive: it seeds itself from
  // everything available, so an empty one means every entry it had has gone.
  const cross =
    pruned.dimension !== "nada" && hasEntries(pruned, pruned.cross) ? pruned.cross : "nada";

  return { ...pruned, cross };
}

/** Clamps a shape to one the transformation admits; the head of the list is the default. */
export function shapeFor(transform: TransformId, wanted: ChartType): ChartType {
  const allowed = SHAPES_BY_TRANSFORM[transform];
  return allowed.includes(wanted) ? wanted : allowed[0];
}

/**
 * Color by center, ordered by the SELECTOR. That order does not move when a series leaves the
 * chart, so dropping one center repaints nothing and a center keeps its color across the cards
 * of a tab — exactly what the requirement asks for.
 */
export function centerColorResolver(centerIds: readonly string[]): (key: SeriesKey) => string {
  const order = [...centerIds];
  return (key) => colorForEntity(key.centerId, order);
}

/**
 * Color by account, ordered by the file among the accounts being compared.
 *
 * The universe here is the COMPARED set and not the whole chart of accounts, which is the one
 * concession in the color rule: a real statement carries dozens of accounts and only eight
 * slots exist, so ordering against the whole file would paint almost everything neutral. The
 * cost is that removing one account can shift the slots of the rest — the requirement's two
 * stability scenarios are both about centers, where `centerColorResolver` holds exactly.
 */
export function codeColorResolver(codes: readonly string[]): (key: SeriesKey) => string {
  const order = [...codes];
  return (key) => colorForEntity(key.code, order);
}

/**
 * The color rule for a selection: centers take the selector's order, accounts the file's, and a
 * cross colors the (cuenta, centro) PAIR — because that is what its legend names.
 */
export function colorResolver(
  selection: AnalyticsSelection,
  context: SelectionContext,
): (key: SeriesKey) => string {
  const byCenter = onAxis(selection, "centros");
  const byAccount = onAxis(selection, "cuentas") || onAxis(selection, "niveles");

  if (byCenter && byAccount) {
    const order = codesFor(selection, context).flatMap((code) =>
      selection.centerIds.map((centerId) => pairId(code, centerId)),
    );
    return (key) => colorForEntity(pairId(key.code, key.centerId), order);
  }
  if (byCenter) {
    return centerColorResolver(context.sources.map((candidate) => candidate.centerId));
  }
  return codeColorResolver(codesFor(selection, context));
}

/** One entry of the "Agregar" picker, whatever dimension is active. */
export interface SelectionEntryOption {
  id: string;
  label: string;
  /** Secondary text — the account code, the center's role. */
  hint?: string;
}

/**
 * What the "Agregar" picker offers for a dimension: the real accounts of the active center,
 * the real centers of the workspace, the depths the file actually has, the periods of the
 * current frequency. It lives here and not in the component so the picker cannot drift from
 * what `toSeriesQuery` will accept.
 */
export function entryOptionsFor(
  dimension: CompareDimension,
  context: SelectionContext,
): SelectionEntryOption[] {
  const source = activeSource(context);

  switch (dimension) {
    case "cuentas":
      return source
        ? [...source.valuesByCode.keys()].map((code) => ({
            id: code,
            label: source.namesByCode.get(code) ?? code,
            hint: code,
          }))
        : [];

    case "centros":
      return context.sources.map((candidate) => ({
        id: candidate.centerId,
        label: candidate.centerName,
      }));

    case "niveles": {
      const depths = source ? [...new Set([...source.valuesByCode.keys()].map(depthOf))] : [];
      return depths
        .sort((a, b) => a - b)
        .map((level) => ({ id: String(level), label: `Nivel ${level}` }));
    }

    case "periodos":
      return periodsForYear(context.year, context.frequency).map((period) => ({
        id: String(period.index),
        label: periodLabel(period),
      }));

    default:
      return [];
  }
}

/** The ids currently picked on a dimension — what the picker ticks. */
export function selectedIdsFor(
  selection: AnalyticsSelection,
  dimension: CompareDimension,
): Set<string> {
  switch (dimension) {
    case "cuentas":
      return new Set(selection.codes);
    case "centros":
      return new Set(selection.centerIds);
    case "niveles":
      return new Set(selection.levels.map(String));
    case "periodos":
      return new Set(selection.periods.map((period) => String(period.index)));
    default:
      return new Set();
  }
}

/**
 * Adds or removes one entry of the ACTIVE dimension, keeping the list in the universe's own
 * order rather than in click order — so the series come out in file order and the colors line
 * up with what `colorResolver` computes from that same universe.
 */
export function withEntryToggled(
  selection: AnalyticsSelection,
  id: string,
  context: SelectionContext,
): AnalyticsSelection {
  const dimension = selection.dimension;
  const order = entryOptionsFor(dimension, context).map((option) => option.id);
  const picked = selectedIdsFor(selection, dimension);
  if (picked.has(id)) {
    picked.delete(id);
  } else {
    picked.add(id);
  }
  const ids = order.filter((candidate) => picked.has(candidate));

  switch (dimension) {
    case "cuentas":
      return { ...selection, codes: ids };
    case "centros":
      return { ...selection, centerIds: ids };
    case "niveles":
      return { ...selection, levels: ids.map(Number) };
    case "periodos":
      return {
        ...selection,
        periods: periodsForYear(context.year, context.frequency).filter((period) =>
          ids.includes(String(period.index)),
        ),
      };
    default:
      return selection;
  }
}

/** Switching the primary dimension starts its list empty and drops any cross. */
export function withDimension(
  selection: AnalyticsSelection,
  dimension: CompareDimension,
): AnalyticsSelection {
  return {
    ...selection,
    dimension,
    cross: "nada",
    codes: [],
    centerIds: [],
    levels: [],
    periods: [],
  };
}

/**
 * "Y también por X" means *split by every X there is* — so choosing the cross fills its axis
 * instead of opening a second picker the box has no room for. Overshooting is safe: the query
 * caps at eight series and the engine reports what it dropped.
 */
export function withCross(
  selection: AnalyticsSelection,
  cross: CompareDimension,
  context: SelectionContext,
): AnalyticsSelection {
  if (cross === "nada") {
    return { ...selection, cross };
  }
  const every = entryOptionsFor(cross, context).map((option) => option.id);

  switch (cross) {
    case "centros":
      return { ...selection, cross, centerIds: every };
    case "cuentas":
      return {
        ...selection,
        cross,
        codes: context.focusedCodes.length > 0 ? [...context.focusedCodes] : [DEFAULT_FOCUS_CODE],
      };
    case "niveles":
      return { ...selection, cross, levels: every.slice(0, 1).map(Number) };
    default:
      return {
        ...selection,
        cross,
        periods: periodsForYear(context.year, context.frequency),
      };
  }
}

/** Every code of the active source at the given depths, in file order. */
export function codesForLevels(
  source: AnalyticsSource | undefined,
  levels: readonly number[],
): string[] {
  if (!source || levels.length === 0) {
    return [];
  }
  const wanted = new Set(levels);
  return [...source.valuesByCode.keys()].filter((code) => wanted.has(depthOf(code)));
}

export function activeSource(context: SelectionContext): AnalyticsSource | undefined {
  return context.sources.find((source) => source.centerId === context.activeCenterId);
}

function codesFor(selection: AnalyticsSelection, context: SelectionContext): string[] {
  if (onAxis(selection, "cuentas")) {
    return selection.codes;
  }
  if (onAxis(selection, "niveles")) {
    return codesForLevels(activeSource(context), selection.levels);
  }
  return context.focusedCodes.length > 0 ? [...context.focusedCodes] : [DEFAULT_FOCUS_CODE];
}

/** Whether a dimension is in play, as the primary axis or as the cross. */
function onAxis(selection: AnalyticsSelection, dimension: CompareDimension): boolean {
  return (
    selection.dimension === dimension ||
    (selection.dimension !== "nada" && selection.cross === dimension)
  );
}

function hasEntries(selection: AnalyticsSelection, dimension: CompareDimension): boolean {
  switch (dimension) {
    case "cuentas":
      return selection.codes.length > 0;
    case "centros":
      return selection.centerIds.length > 0;
    case "niveles":
      return selection.levels.length > 0;
    case "periodos":
      return selection.periods.length > 0;
    default:
      return false;
  }
}

function depthOf(code: string): number {
  return code.split(".").length;
}

function pairId(code: string, centerId: string): string {
  return `${code}|${centerId}`;
}
