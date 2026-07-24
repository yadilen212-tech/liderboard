"use client";

import { useState } from "react";
import { ComingSoon } from "@/components/dashboard/coming-soon";
import { AnalisisView } from "@/components/profit-loss/charts/analisis-view";
import { GraficosView } from "@/components/profit-loss/charts/graficos-view";
import { DatosToolbar } from "@/components/profit-loss/datos-toolbar";
import { DatosView } from "@/components/profit-loss/datos-view";
import { PygToolbar } from "@/components/profit-loss/pyg-toolbar";
import { Semaforo } from "@/components/profit-loss/semaforo";
import { cn } from "@/lib/cn";
import { findModuleBySlug, type ModuleTabId } from "@/lib/modules";

export function ModuleTabs({ slug }: { slug: string }) {
  const mod = findModuleBySlug(slug);
  const [activeId, setActiveId] = useState<ModuleTabId>(mod?.tabs[0]?.id ?? "graficos");

  if (!mod) {
    return null;
  }

  const activeTab = mod.tabs.find((tab) => tab.id === activeId) ?? mod.tabs[0];
  const isPyg = mod.slug === "profit-loss";

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-end justify-between gap-6 border-b border-border bg-surface px-7 pt-[18px]">
        <div role="tablist" aria-label={`Vistas de ${mod.label}`} className="flex items-end gap-6">
          {mod.tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${mod.slug}-${tab.id}`}
                aria-selected={active}
                aria-controls={`panel-${mod.slug}`}
                onClick={() => setActiveId(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 py-2.5 text-sm font-semibold transition-colors",
                  active ? "text-brand" : "text-faint hover:text-muted",
                )}
              >
                <Icon size={16} strokeWidth={1.9} />
                {tab.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-[3px] bg-brand" />
                )}
              </button>
            );
          })}
        </div>

        {isPyg && <Semaforo />}
      </div>

      {isPyg && <PygToolbar activeTab={activeTab.id} />}
      {isPyg && activeTab.id === "datos" && <DatosToolbar />}

      <div
        id={`panel-${mod.slug}`}
        role="tabpanel"
        aria-labelledby={`tab-${mod.slug}-${activeTab.id}`}
        className="flex-1 overflow-auto bg-canvas"
      >
        {isPyg && activeTab.id === "datos" ? (
          <DatosView />
        ) : isPyg && activeTab.id === "graficos" ? (
          <GraficosView />
        ) : isPyg && activeTab.id === "analisis" ? (
          <AnalisisView />
        ) : (
          <ComingSoon mod={mod} tab={activeTab} />
        )}
      </div>
    </div>
  );
}
