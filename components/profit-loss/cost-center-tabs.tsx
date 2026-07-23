"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CenterView } from "./pyg-data-provider";

/**
 * The "Centro de costos" tab strip above the Datos grid: one pill per view (Consolidado, each
 * center, Sin centro de costo). Rendered only when the workspace is multi-center.
 */
export function CostCenterTabs({
  views,
  activeId,
  onSelect,
}: {
  views: CenterView[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (views.length === 0) {
    return null;
  }

  return (
    <div className="mb-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="mr-0.5 text-[10.5px] font-semibold uppercase tracking-[0.6px] text-faintest">
          Centro de costos
        </span>
        {views.map((view) => {
          const active = view.id === activeId;
          return (
            <button
              key={view.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(view.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                active
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border bg-surface text-muted hover:bg-canvas",
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{
                  backgroundColor: active
                    ? (view.color ?? "var(--color-brand)")
                    : "var(--color-faintest)",
                }}
              />
              {view.name}
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-faint">
        <Info size={13} className="shrink-0" />
        El Consolidado suma los centros mensuales. "Sin centro de costo" viene del archivo
        consolidado (anual, solo lectura).
      </p>
    </div>
  );
}
