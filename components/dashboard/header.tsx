"use client";

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { ActiveClient, type ActiveClientInfo } from "@/components/dashboard/active-client";
import { usePygData } from "@/components/profit-loss/pyg-data-provider";
import { DEFAULT_MODULE, findModuleBySlug } from "@/lib/modules";

export function DashboardHeader() {
  const pathname = usePathname();
  const { dataset, mode, views, activeCenterId } = usePygData();
  const slug = pathname.split("/").filter(Boolean)[0];
  const current = findModuleBySlug(slug) ?? DEFAULT_MODULE;
  const isPyg = current.slug === "profit-loss";

  // In multi-center mode the subline names the active view (Consolidado / center / Sin-centro);
  // a single statement falls back to its own cost-center line, if any.
  const activeView = mode === "multi" ? views.find((v) => v.id === activeCenterId) : undefined;
  const centerCount = views.filter((v) => v.role === "center").length;
  const activeName = activeView
    ? activeView.role === "consolidado"
      ? `Consolidado (${centerCount} ${centerCount === 1 ? "centro" : "centros"})`
      : activeView.name
    : dataset?.costCenterName;
  const client: ActiveClientInfo | undefined = dataset
    ? {
        name: dataset.companyName,
        period: activeName ? `${dataset.periodLabel} · ${activeName}` : dataset.periodLabel,
      }
    : undefined;

  return (
    <header className="flex items-center gap-5 border-b border-border bg-surface px-7 py-4">
      <div className="min-w-0">
        <div className="mb-0.5 flex items-center gap-2 text-[11.5px] font-medium text-faint">
          <span>Módulos</span>
          <ChevronRight size={13} className="shrink-0" />
          <span className="truncate text-muted">{current.title}</span>
        </div>
        <h1 className="truncate text-xl font-bold tracking-tight text-brand">{current.title}</h1>
      </div>

      {isPyg && <ActiveClient client={client} />}
    </header>
  );
}
