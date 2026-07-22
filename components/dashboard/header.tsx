"use client";

import { ChevronRight, Download } from "lucide-react";
import { usePathname } from "next/navigation";
import { DEFAULT_MODULE, findModuleBySlug } from "@/lib/modules";

export function DashboardHeader() {
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean)[0];
  const current = findModuleBySlug(slug) ?? DEFAULT_MODULE;

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

      <button
        type="button"
        onClick={() => {
          // TODO: wire per-module export logic when modules are implemented.
        }}
        className="ml-auto flex shrink-0 items-center gap-2 rounded-[9px] bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        <Download size={15} />
        <span>Exportar</span>
      </button>
    </header>
  );
}
