/**
 * App-wide formatting helpers. Every user-facing number should be rendered through
 * these so the whole dashboard speaks one language — Ecuadorian USD, Spanish locale.
 * Reach for these from any module (PyG, Sueldos, Ventas, …) instead of re-formatting
 * locally.
 */

const EC_CURRENCY_WHOLE = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const EC_CURRENCY_CENTS = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Ecuadorian USD currency, sign ahead of the symbol ("$1.234" / "-$1.234"). Ecuador
 * uses the US dollar, so `es-EC` yields `.` grouping and a `$` symbol. Whole dollars by
 * default (dense tables read cleaner); pass `{ cents: true }` for two decimals.
 */
export function formatCurrency(value: number, options?: { cents?: boolean }): string {
  const formatter = options?.cents ? EC_CURRENCY_CENTS : EC_CURRENCY_WHOLE;
  const formatted = formatter.format(Math.abs(value));
  return value < 0 ? `-${formatted}` : formatted;
}

const EC_NUMBER = new Intl.NumberFormat("es-EC");

/** Plain Ecuadorian-grouped number, no currency symbol ("1.234,5"). */
export function formatNumber(value: number): string {
  return EC_NUMBER.format(value);
}

/** Percentage with one decimal, Spanish spacing ("12,4 %"). */
export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toLocaleString("es-EC", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} %`;
}
