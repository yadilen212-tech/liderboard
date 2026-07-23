"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CostCenter } from "@/lib/profit-loss/datos-types";

/**
 * The "Centro de costos" tab strip that sits above the Datos grid: one pill per center,
 * plus a hint line explaining what switching does.
 *
 * FUTURE WORK: this strip is only meaningful when the uploaded data actually carries
 * cost centers. Detection (does this Excel/ZIP split by sucursal?) is not built yet, so
 * for now it always renders from mock centers to preview the layout. Once detection
 * lands, gate the whole strip on "data has cost centers" and drop the mock source.
 */
export function CostCenterTabs({
  centers,
  activeId,
  onSelect,
}: {
  centers: CostCenter[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (centers.length === 0) {
    return null;
  }

  return (
    <div className="mb-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="mr-0.5 text-[10.5px] font-semibold uppercase tracking-[0.6px] text-faintest">
          Centro de costos
        </span>
        {centers.map((center) => {
          const active = center.id === activeId;
          return (
            <button
              key={center.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(center.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                active
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border bg-surface text-muted hover:bg-canvas",
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ backgroundColor: active ? center.color : "var(--color-faintest)" }}
              />
              {center.name}
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-faint">
        <Info size={13} className="shrink-0" />
        Cada centro de costos muestra su propio estado de resultados. El comparativo entre centros
        vive en la pestaña Análisis.
      </p>
    </div>
  );
}
