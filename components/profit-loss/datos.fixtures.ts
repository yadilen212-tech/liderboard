/**
 * Placeholder data for the Datos view.
 *
 * `MOCK_COST_CENTERS` feeds the cost-center tab strip, retained for the FUTURE WORK
 * cost-center milestone — the strip is gated off until then (see `cost-center-tabs.tsx`).
 */
import type { CostCenter } from "@/lib/profit-loss/datos-types";

/** Cost-center palette from the design (`_ccColorMap`). */
const CC_PALETTE = ["#1e3a5f", "#0e7490", "#d97706", "#16a34a", "#7c3aed", "#dc2626"];

export const MOCK_COST_CENTERS: CostCenter[] = [
  { id: "matriz", name: "Matriz", color: CC_PALETTE[0] },
  { id: "norte", name: "Sucursal Norte", color: CC_PALETTE[1] },
  { id: "sur", name: "Sucursal Sur", color: CC_PALETTE[2] },
];
