"use client";

import { FileSpreadsheet } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/format";
import { periodLabel } from "@/lib/profit-loss/analytics/period";
import { toPieSlices } from "@/lib/profit-loss/analytics/structure";
import {
  entryTable,
  horizontalBarOption,
  pieOption,
  seriesOptionFor,
  seriesTableFor,
  type ChartTable,
} from "@/lib/profit-loss/charts/option";
import {
  amountOf,
  amountsAt,
  compositionQuery,
  excludedNote,
  EXPENSE_ROOT,
  lastCoveredIndex,
  leavesOf,
  presetQuery,
  REVENUE_ROOT,
  topEntries,
} from "@/lib/profit-loss/charts/presets";
import { activeSource, codeColorResolver } from "@/lib/profit-loss/charts/selection";
import { usePygAnalytics } from "../pyg-analytics-provider";
import { usePygData } from "../pyg-data-provider";
import { ChartCard } from "./chart-card";
import { StatTile } from "./stat-tile";

const EMPTY_TABLE: ChartTable = { columns: [], rows: [] };

/**
 * Gráficos answers *how much and of what*: amounts per period, comparisons between accounts
 * and centers, composition of a total. No transformation selector — that is Análisis.
 *
 * With an Excel loaded it shows something useful before the user configures anything, because
 * a blank panel next to a loaded file hands the reader the job of guessing what can be asked.
 * The presets are ordinary queries, the same route `Comparar` takes; picking a dimension
 * replaces the comparison card and keeps the stat tiles, and «Nada» brings the preset back.
 */
export function GraficosView() {
  const { dataset } = usePygData();
  const { context, comparing, comparison, colorOf, selection, runQuery } = usePygAnalytics();
  const source = activeSource(context);

  const totals = useMemo(
    () => runQuery(presetQuery([REVENUE_ROOT, EXPENSE_ROOT], context)),
    [runQuery, context],
  );
  // ONE period for the whole tab. Every card names it in its subtitle, so they cannot be
  // allowed to each pick their own: a statement whose revenue stops in July but keeps booking
  // a small cost through December has coverage to the end, and cards resolving it separately
  // would caption one "Jul" and the next "Dic" over the same screen.
  const period = useMemo(() => lastCoveredIndex(totals), [totals]);
  const periodName = totals.periods[period]
    ? periodLabel(totals.periods[period])
    : "Sin movimiento";

  const revenue = amountOf(totals, REVENUE_ROOT, period);
  const expense = amountOf(totals, EXPENSE_ROOT, period);
  const result = revenue !== null && expense !== null ? revenue - expense : null;
  const totalsColor = useMemo(() => codeColorResolver([REVENUE_ROOT, EXPENSE_ROOT]), []);

  // Composition of revenue over the movement accounts under "4". The cap is lifted here
  // because `toPieSlices` folds its own tail into «Otros» and sets the negative Rebajas row
  // aside — truncating at eight first would hide accounts the pie was going to group anyway.
  const composition = useMemo(
    () => runQuery(compositionQuery(leavesOf(source, REVENUE_ROOT), context)),
    [runQuery, source, context],
  );
  const slices = useMemo(() => toPieSlices(amountsAt(composition, period)), [composition, period]);
  const sliceColor = useMemo(() => entryColor(slices.slices.map((slice) => slice.code)), [slices]);

  // Ranking of expenses: sorted BEFORE the cut, so the largest cannot fall off the list.
  const expenses = useMemo(
    () => runQuery(compositionQuery(leavesOf(source, EXPENSE_ROOT), context)),
    [runQuery, source, context],
  );
  const ranking = useMemo(() => topEntries(amountsAt(expenses, period)), [expenses, period]);
  const rankingColor = useMemo(
    () => entryColor(ranking.entries.map((entry) => entry.code)),
    [ranking],
  );

  const comparisonSeries = comparison?.series ?? [];
  const comparisonContext = { colorOf, periods: comparison?.periods ?? [] };

  if (!dataset) {
    return (
      <div className="px-7 py-5">
        <EmptyState icon={<FileSpreadsheet size={22} />} className="py-20">
          Carga un Excel para ver el estado de resultados.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-7 py-5">
      <div className="flex gap-4">
        <StatTile
          label="Ingresos"
          value={revenue === null ? null : formatCurrency(revenue)}
          hint={periodName}
        />
        <StatTile
          label="Costos y Gastos"
          value={expense === null ? null : formatCurrency(expense)}
          hint={periodName}
        />
        <StatTile
          label={result !== null && result < 0 ? "Pérdida" : "Utilidad"}
          value={result === null ? null : formatCurrency(result)}
          hint={periodName}
          sign={result === null ? undefined : result < 0 ? "negativo" : "positivo"}
        />
      </div>

      {comparing && comparison ? (
        <ChartCard
          title="Comparación"
          subtitle={`${comparisonSeries.length} ${comparisonSeries.length === 1 ? "serie" : "series"} · ${periodName}`}
          option={
            comparisonSeries.length > 0
              ? seriesOptionFor(selection.chartType, comparisonSeries, comparisonContext)
              : null
          }
          table={seriesTableFor(selection.chartType, comparisonSeries, comparisonContext)}
          warnings={comparison.warnings}
          height={300}
        />
      ) : (
        <ChartCard
          title="Ingresos contra Costos y Gastos"
          subtitle="Evolución por periodo"
          option={
            totals.series.length > 0
              ? seriesOptionFor("barras", totals.series, {
                  colorOf: totalsColor,
                  periods: totals.periods,
                })
              : null
          }
          table={seriesTableFor("barras", totals.series, {
            colorOf: totalsColor,
            periods: totals.periods,
          })}
          warnings={totals.warnings}
          height={300}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <ChartCard
          title="Composición de los ingresos"
          subtitle={periodName}
          option={
            slices.slices.length > 0
              ? pieOption(slices, { colorOf: sliceColor, donut: true })
              : null
          }
          table={
            slices.slices.length > 0
              ? entryTable(slices.slices, { colorOf: sliceColor })
              : EMPTY_TABLE
          }
          warnings={composition.warnings}
          note={excludedNote(slices.excluded)}
          height={280}
        />

        <ChartCard
          title="Ranking de gastos"
          subtitle={`De mayor a menor · ${periodName}`}
          option={
            ranking.entries.length > 0
              ? horizontalBarOption(ranking.entries, { colorOf: rankingColor })
              : null
          }
          table={
            ranking.entries.length > 0
              ? entryTable(ranking.entries, { colorOf: rankingColor })
              : EMPTY_TABLE
          }
          warnings={expenses.warnings}
          note={
            ranking.hidden > 0
              ? `Se muestran las ${ranking.entries.length} cuentas más grandes; ${ranking.hidden} quedaron fuera.`
              : undefined
          }
          height={280}
        />
      </div>
    </div>
  );
}

/** Entry-based cards color by account code, ordered by the list the card actually draws. */
export function entryColor(codes: string[]): (code: string) => string {
  const resolve = codeColorResolver(codes);
  return (code) => resolve({ code, centerId: "", year: 0 });
}
