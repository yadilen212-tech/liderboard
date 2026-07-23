/**
 * Shared calendar labels (Spanish). Any module that lays out monthly columns should
 * pull from here rather than re-declaring the list, so month order and spelling stay
 * consistent across the app.
 */

/** Short month labels, January-first: ["Ene", …, "Dic"]. */
export const MONTHS_SHORT_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

/**
 * Full month names, index-aligned with `MONTHS_SHORT_ES`. Used where labels must be
 * unabbreviated — the PyG export header (which parse reads back, matching these names).
 */
export const MONTHS_FULL_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;
