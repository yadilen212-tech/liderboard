/**
 * Placeholder data for the Datos view.
 *
 * `MOCK_COST_CENTERS` feeds the cost-center tab strip, which the design keeps visible
 * as a preview until the real Excel loader can *detect* whether uploaded data carries
 * cost centers (that gate is FUTURE WORK — see `cost-center-tabs.tsx`).
 *
 * `MOCK_GRIDS` is a populated Estado de Resultados used only to verify/screenshot the
 * full table (tree, sort, editing) — it is NOT wired as the running-app default, which
 * stays on the empty state until Excel data exists. Delete both when the loader lands.
 */
import { MONTHS_SHORT_ES } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import type { CostCenter, DatosGrid, DatosRow } from "./datos-types";

/** Cost-center palette from the design (`_ccColorMap`). */
const CC_PALETTE = ["#1e3a5f", "#0e7490", "#d97706", "#16a34a", "#7c3aed", "#dc2626"];

export const MOCK_COST_CENTERS: CostCenter[] = [
  { id: "matriz", name: "Matriz", color: CC_PALETTE[0] },
  { id: "norte", name: "Sucursal Norte", color: CC_PALETTE[1] },
  { id: "sur", name: "Sucursal Sur", color: CC_PALETTE[2] },
];

const MONTHS = MONTHS_SHORT_ES;

/** Twelve months seeded from a base value with a mild deterministic wave (no RNG). */
function series(base: number, swing = 0.12): { value: number }[] {
  return MONTHS.map((_, i) => ({
    value: Math.round(base * (1 + swing * Math.sin(i / 1.7)) * (1 + (i % 3) * 0.03)),
  }));
}

function row(
  code: string,
  name: string,
  level: number,
  base: number,
  children?: DatosRow[],
): DatosRow {
  return { code, name, level, cells: series(base), children };
}

/** A compact but realistic hotel P&L, scaled per cost center. */
function buildGrid(
  id: string,
  title: string,
  dotColor: string | undefined,
  scale: number,
): DatosGrid {
  const s = (base: number) => Math.round(base * scale);
  const rows: DatosRow[] = [
    row("4", "INGRESOS", 1, s(82000), [
      row("4.1", "Hospedaje", 2, s(48000), [
        row("4.1.01", "Habitaciones", 3, s(41000)),
        row("4.1.02", "Servicios adicionales", 3, s(7000)),
      ]),
      row("4.2", "Alimentos y bebidas", 2, s(26000), [
        row("4.2.01", "Restaurante", 3, s(19000)),
        row("4.2.02", "Bar", 3, s(7000)),
      ]),
      row("4.3", "Otros ingresos", 2, s(8000)),
    ]),
    row("5", "COSTOS Y GASTOS", 1, s(-61000), [
      row("5.1", "Costo de ventas", 2, s(-24000), [
        row("5.1.01", "Insumos de cocina", 3, s(-15000)),
        row("5.1.02", "Bebidas", 3, s(-9000)),
      ]),
      row("5.2", "Sueldos y beneficios", 2, s(-22000), [
        row("5.2.01", "Sueldos", 3, s(-16000)),
        row("5.2.02", "Aportes IESS", 3, s(-6000)),
      ]),
      row("5.3", "Gastos operativos", 2, s(-15000), [
        row("5.3.01", "Servicios básicos", 3, s(-6000)),
        row("5.3.02", "Mantenimiento", 3, s(-5000)),
        row("5.3.03", "Marketing", 3, s(-4000)),
      ]),
    ]),
  ];

  const utilMonthly = MONTHS.map((_, i) => sumAt(rows, i));
  const utilTotal = utilMonthly.reduce((a, b) => a + b, 0);
  rows.push({
    code: "",
    name: "Utilidad o Pérdida",
    level: 1,
    isResult: true,
    cells: utilMonthly.map((value) => ({ value })),
  });

  return {
    id,
    title,
    dotColor,
    months: [...MONTHS],
    utilidad: {
      label: `${utilTotal < 0 ? "Pérdida" : "Utilidad"} ${formatCurrency(Math.abs(utilTotal))}`,
      positive: utilTotal >= 0,
    },
    rows,
  };
}

/** Sum of every top-level row's month `i` (children roll up into their parent's base). */
function sumAt(rows: DatosRow[], i: number): number {
  return rows.reduce((acc, r) => acc + (r.isResult ? 0 : (r.cells[i]?.value ?? 0)), 0);
}

export const MOCK_GRIDS: DatosGrid[] = [
  buildGrid("matriz", "Matriz", CC_PALETTE[0], 1),
  buildGrid("norte", "Sucursal Norte", CC_PALETTE[1], 0.62),
  buildGrid("sur", "Sucursal Sur", CC_PALETTE[2], 0.44),
];
