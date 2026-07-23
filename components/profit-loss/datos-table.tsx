"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  FileSpreadsheet,
  MousePointerClick,
} from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import type { EditorAnchor } from "./cell-editor";
import { DatosTableRow } from "./datos-table-row";
import type { DatosGrid, DatosSort, DatosSortKey } from "@/lib/profit-loss/datos-types";
import type { FlatRow } from "./datos-utils";

export interface DatosTableProps {
  grid: DatosGrid;
  rows: FlatRow[];
  sort: DatosSort | null;
  editable: boolean;
  showTotal: boolean;
  onSort: (key: DatosSortKey) => void;
  onToggle: (code: string) => void;
  onEditCell: (code: string, col: number, anchor: EditorAnchor, valueEditable: boolean) => void;
}

/** Two sort keys point at the same column when both are the name / total sentinels. */
function sameKey(a: DatosSortKey, b: DatosSortKey): boolean {
  if (typeof a === "object" && typeof b === "object") {
    return a.col === b.col;
  }
  return a === b;
}

/** One editable Estado de Resultados grid — for the whole company or a cost center. */
export function DatosTable({
  grid,
  rows,
  sort,
  editable,
  showTotal,
  onSort,
  onToggle,
  onEditCell,
}: DatosTableProps) {
  const accountCount = rows.filter((flat) => !flat.row.isResult).length;

  return (
    <div className="mb-4 overflow-hidden rounded-[13px] border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-header px-[18px] py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {grid.dotColor && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: grid.dotColor }}
            />
          )}
          <span className="truncate text-sm font-semibold text-ink">{grid.title}</span>
        </div>
        {grid.utilidad && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums",
              grid.utilidad.positive
                ? "bg-positive/10 text-positive"
                : "bg-negative/10 text-negative",
            )}
          >
            {grid.utilidad.label}
          </span>
        )}
      </header>

      {grid.rows.length === 0 ? (
        <EmptyState icon={<FileSpreadsheet size={22} />} className="py-14">
          Carga un Excel para ver el estado de resultados.
        </EmptyState>
      ) : (
        <>
          <div className="max-h-[62vh] min-h-[180px] overflow-auto">
            <table className="w-full min-w-[960px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <SortableTh
                    align="left"
                    active={sort ? sameKey(sort.key, "name") : false}
                    dir={sort?.dir}
                    onClick={() => onSort("name")}
                    className="min-w-[300px]"
                  >
                    Cuenta
                  </SortableTh>
                  {grid.months.map((month, col) => (
                    <SortableTh
                      key={month}
                      align="right"
                      active={sort ? sameKey(sort.key, { col }) : false}
                      dir={sort?.dir}
                      onClick={() => onSort({ col })}
                    >
                      {month}
                    </SortableTh>
                  ))}
                  {showTotal && (
                    <SortableTh
                      align="right"
                      active={sort ? sameKey(sort.key, "total") : false}
                      dir={sort?.dir}
                      onClick={() => onSort("total")}
                      className="border-l border-border"
                    >
                      Total
                    </SortableTh>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((flat) => (
                  <DatosTableRow
                    key={flat.row.code || "resultado"}
                    row={flat.row}
                    hasChildren={flat.hasChildren}
                    isCollapsed={flat.isCollapsed}
                    monthsCount={grid.months.length}
                    editable={editable}
                    showTotal={showTotal}
                    onToggle={onToggle}
                    onEditCell={onEditCell}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-wrap items-center gap-4 border-t border-border bg-surface-header px-[18px] py-2.5 text-[11.5px] text-faint">
            <LegendItem>
              <span className="h-[9px] w-[9px] rounded-[2px] bg-negative" />
              Negativos en rojo
            </LegendItem>
            <LegendItem>
              <span
                className="h-0 w-0"
                style={{
                  borderTop: "9px solid var(--color-warning)",
                  borderLeft: "9px solid transparent",
                }}
              />
              Celda con comentario
            </LegendItem>
            {editable && (
              <LegendItem>
                <MousePointerClick size={13} />
                Clic en una celda para editar o comentar
              </LegendItem>
            )}
            <span className="ml-auto font-mono">{accountCount} cuentas</span>
          </footer>
        </>
      )}
    </div>
  );
}

function SortableTh({
  align,
  active,
  dir,
  onClick,
  className,
  children,
}: {
  align: "left" | "right";
  active: boolean;
  dir?: "asc" | "desc";
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "sticky top-0 z-[2] cursor-pointer select-none whitespace-nowrap border-b border-border bg-surface-header px-4 py-2.5 text-[11px] font-semibold transition-colors",
        active ? "text-brand" : "text-muted hover:text-ink",
        align === "left" ? "text-left uppercase tracking-[0.5px]" : "text-right",
        className,
      )}
    >
      <span
        className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}
      >
        {children}
        {active ? (
          dir === "asc" ? (
            <ArrowUp size={12} />
          ) : (
            <ArrowDown size={12} />
          )
        ) : (
          <ChevronsUpDown size={12} className="text-faintest" />
        )}
      </span>
    </th>
  );
}

function LegendItem({ children }: { children: ReactNode }) {
  return <span className="flex items-center gap-1.5">{children}</span>;
}
