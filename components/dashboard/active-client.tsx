import { cn } from "@/lib/cn";

export interface ActiveClientInfo {
  /** Empresa / client shown in bold. */
  name: string;
  /** Period label for the subline, e.g. "Ene–Dic 2026". */
  period?: string;
}

/**
 * Active-client block for the module header (Pérdidas y Ganancias). With no
 * `client` it renders the empty state; pass parsed Excel metadata to populate it.
 */
export function ActiveClient({ client }: { client?: ActiveClientInfo }) {
  const hasClient = Boolean(client?.name);
  const name = client?.name ?? "Sin cliente seleccionado";
  const period = client?.period ?? "N/A";

  return (
    <div className="ml-auto flex min-w-0 flex-col items-end gap-[3px]">
      <span
        className={cn(
          "max-w-[360px] truncate text-[15px] font-bold tracking-[-0.2px]",
          hasClient ? "text-brand" : "text-faint",
        )}
      >
        {name}
      </span>
      <div className="flex items-center gap-[7px] text-[11.5px] font-medium text-faint">
        <span>Estado de resultados</span>
        <span className="text-faintest">·</span>
        <span>{period}</span>
      </div>
    </div>
  );
}
