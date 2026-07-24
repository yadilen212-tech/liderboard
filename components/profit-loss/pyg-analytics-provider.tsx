"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { buildSeries } from "@/lib/profit-loss/analytics/series";
import type {
  AnalyticsSource,
  SeriesBundle,
  SeriesKey,
  SeriesQuery,
} from "@/lib/profit-loss/analytics/types";
import {
  colorResolver,
  emptySelection,
  entryOptionsFor,
  isComparing,
  sanitizeSelection,
  selectedIdsFor,
  toSeriesQuery,
  withCross,
  withDimension,
  withEntryToggled,
  type AnalyticsSelection,
  type ChartType,
  type CompareDimension,
  type SelectionContext,
  type SelectionEntryOption,
  type TransformId,
} from "@/lib/profit-loss/charts/selection";
import { sourcesFromViews } from "@/lib/profit-loss/charts/sources";
import type { CellEdit } from "@/lib/profit-loss/types";
import { usePygData } from "./pyg-data-provider";

interface PygAnalyticsValue {
  /** One per selector view — Consolidado included — ready for `buildSeries`. */
  sources: AnalyticsSource[];
  /** The active center, frequency, year and account focus a query is read against. */
  context: SelectionContext;
  selection: AnalyticsSelection;
  /** `false` while the user has not picked a dimension: the tab shows its preset. */
  comparing: boolean;
  /** The comparison the user asked for; `null` while `comparing` is false. */
  comparison: SeriesBundle | null;
  /** The one way a series gets a color, so a center keeps its own across cards. */
  colorOf: (key: SeriesKey) => string;
  /** What "Agregar" offers for the active dimension, and what is already ticked. */
  entryOptions: SelectionEntryOption[];
  pickedIds: Set<string>;
  setDimension: (dimension: CompareDimension) => void;
  setCross: (cross: CompareDimension) => void;
  toggleEntry: (id: string) => void;
  setTransform: (transform: TransformId) => void;
  setChartType: (chartType: ChartType) => void;
  /** Runs a preset query against the same sources the comparison uses. */
  runQuery: (query: SeriesQuery) => SeriesBundle;
}

const PygAnalyticsContext = createContext<PygAnalyticsValue | null>(null);

/**
 * The analytics selection — which series the user wants to see — living in its own file but in
 * the PyG provider's tree, so `CompareBar` (rendered by the toolbar) and the content panel read
 * one state. `PygDataProvider` mounts it internally: the dashboard layout has a single mount
 * point either way, and `pyg-data-provider.tsx` does not grow a sixth responsibility.
 *
 * It is memory-only on purpose. A selection means nothing without the workspace that produced
 * it, so it survives switching between Gráficos and Análisis and is gone after a reload — where
 * each tab's default view leaves the user on something useful rather than on a blank panel.
 *
 * `allEdits` arrives as a prop rather than through the data context because the sources need
 * EVERY center's edits, while the context exposes only the active view's.
 */
export function PygAnalyticsProvider({
  allEdits,
  children,
}: {
  allEdits: CellEdit[];
  children: ReactNode;
}) {
  const { views, frequency, activeCenterId, dataset, selectedAccounts } = usePygData();

  // Rebuilding the sources is the cost of an edit: the numbers changed, so must the series.
  // Memoizing against `views`/`allEdits` keeps every OTHER render — a filter, a tab, a
  // frequency — from walking the account tree again.
  const sources = useMemo(() => sourcesFromViews(views, allEdits), [views, allEdits]);

  const workspaceKey = useMemo(() => views.map((view) => view.dataset.id).join("|"), [views]);
  const focusedCodes = useMemo(() => [...selectedAccounts], [selectedAccounts]);
  const year = dataset?.year ?? 0;

  const context = useMemo<SelectionContext>(
    () => ({ sources, workspaceKey, activeCenterId, frequency, year, focusedCodes }),
    [sources, workspaceKey, activeCenterId, frequency, year, focusedCodes],
  );

  const [raw, setRaw] = useState<AnalyticsSelection>(() => emptySelection(workspaceKey));

  // Sanitizing on read rather than in an effect means the selection is NEVER out of step with
  // the workspace, the center or the frequency — not even for the render in between.
  const selection = useMemo(() => sanitizeSelection(raw, context), [raw, context]);
  const comparing = isComparing(selection);

  const query = useMemo(
    () => (comparing ? toSeriesQuery(selection, context) : null),
    [comparing, selection, context],
  );
  const comparison = useMemo(() => (query ? buildSeries(sources, query) : null), [sources, query]);

  const colorOf = useMemo(() => colorResolver(selection, context), [selection, context]);
  const entryOptions = useMemo(
    () => entryOptionsFor(selection.dimension, context),
    [selection.dimension, context],
  );
  const pickedIds = useMemo(() => selectedIdsFor(selection, selection.dimension), [selection]);

  const setDimension = useCallback(
    (dimension: CompareDimension) => setRaw(withDimension(selection, dimension)),
    [selection],
  );
  const setCross = useCallback(
    (cross: CompareDimension) => setRaw(withCross(selection, cross, context)),
    [selection, context],
  );
  const toggleEntry = useCallback(
    (id: string) => setRaw(withEntryToggled(selection, id, context)),
    [selection, context],
  );
  const setTransform = useCallback(
    (transform: TransformId) => setRaw({ ...selection, transform }),
    [selection],
  );
  const setChartType = useCallback(
    (chartType: ChartType) => setRaw({ ...selection, chartType }),
    [selection],
  );
  const runQuery = useCallback((next: SeriesQuery) => buildSeries(sources, next), [sources]);

  const value = useMemo<PygAnalyticsValue>(
    () => ({
      sources,
      context,
      selection,
      comparing,
      comparison,
      colorOf,
      entryOptions,
      pickedIds,
      setDimension,
      setCross,
      toggleEntry,
      setTransform,
      setChartType,
      runQuery,
    }),
    [
      sources,
      context,
      selection,
      comparing,
      comparison,
      colorOf,
      entryOptions,
      pickedIds,
      setDimension,
      setCross,
      toggleEntry,
      setTransform,
      setChartType,
      runQuery,
    ],
  );

  return <PygAnalyticsContext.Provider value={value}>{children}</PygAnalyticsContext.Provider>;
}

export function usePygAnalytics(): PygAnalyticsValue {
  const context = useContext(PygAnalyticsContext);
  if (!context) {
    throw new Error("usePygAnalytics debe usarse dentro de <PygDataProvider>.");
  }
  return context;
}
