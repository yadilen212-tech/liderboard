"use client";

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { ActiveClient, type ActiveClientInfo } from "@/components/dashboard/active-client";
import { usePygData } from "@/components/profit-loss/pyg-data-provider";
import { DEFAULT_MODULE, findModuleBySlug } from "@/lib/modules";

export function DashboardHeader() {
  const pathname = usePathname();
  const { dataset } = usePygData();
  const slug = pathname.split("/").filter(Boolean)[0];
  const current = findModuleBySlug(slug) ?? DEFAULT_MODULE;
  const isPyg = current.slug === "profit-loss";

  const client: ActiveClientInfo | undefined = dataset
    ? {
        name: dataset.companyName,
        period: dataset.costCenterName
          ? `${dataset.periodLabel} · ${dataset.costCenterName}`
          : dataset.periodLabel,
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
