"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/cn";
import type { EditorAnchor } from "./cell-editor";
import type { DatosRow } from "./datos-types";
import { formatAmount, rowTotal } from "./datos-utils";

const INDENT_STEP = 16;
const BASE_INDENT = 14;

export interface DatosTableRowProps {
  row: DatosRow;
  hasChildren: boolean;
  isCollapsed: boolean;
  monthsCount: number;
  onToggle: (code: string) => void;
  onEditCell: (code: string, col: number, anchor: EditorAnchor, valueEditable: boolean) => void;
}

/**
 * One account row. Memoized so editing or expanding a *different* row — or opening the
 * editor — never re-renders this one (its props are value-stable between such changes).
 * `content-visibility` lets the browser skip layout/paint for rows scrolled out of view.
 */
function DatosTableRowImpl({
  row,
  hasChildren,
  isCollapsed,
  monthsCount,
  onToggle,
  onEditCell,
}: DatosTableRowProps) {
  const emphasized = row.isResult || row.level === 1;
  const nameWeight = row.isResult
    ? "font-bold"
    : row.level === 1
      ? "font-semibold"
      : row.level === 2
        ? "font-medium"
        : "font-normal";
  const paddingLeft = row.isResult ? BASE_INDENT : BASE_INDENT + (row.level - 1) * INDENT_STEP;

  // The result row is fully derived (no editor). Movement accounts (leaves) edit their
  // value + comment; parent accounts roll up from their movements, so they comment only.
  const openable = !row.isResult;
  const valueEditable = openable && !hasChildren;

  return (
    <tr style={{ contentVisibility: "auto", containIntrinsicSize: "auto 39px" }}>
      <td
        className={cn(
          "max-w-[380px] border-b border-border-soft p-0",
          row.isResult && "bg-surface-header",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 overflow-hidden whitespace-nowrap py-2 text-[13px]",
            nameWeight,
            emphasized ? "text-brand" : "text-ink-soft",
          )}
          style={{ paddingLeft, paddingRight: 14 }}
        >
          {hasChildren ? (
            <button
              type="button"
              aria-label={isCollapsed ? "Expandir" : "Colapsar"}
              aria-expanded={!isCollapsed}
              onClick={() => onToggle(row.code)}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-faint transition-colors hover:text-brand"
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <span className="w-4 shrink-0" aria-hidden />
          )}
          {row.code && (
            <span className="shrink-0 font-mono text-[10.5px] text-faint">{row.code}</span>
          )}
          <span className="overflow-hidden text-ellipsis">{row.name}</span>
        </div>
      </td>

      {Array.from({ length: monthsCount }, (_, col) => {
        const cell = row.cells[col];
        return (
          <DataCell
            key={col}
            value={cell?.value ?? null}
            hasComment={Boolean(cell?.comment)}
            openable={openable}
            onEdit={(anchor) => onEditCell(row.code, col, anchor, valueEditable)}
          />
        );
      })}

      <TotalCell value={rowTotal(row)} emphasized={Boolean(row.isResult)} />
    </tr>
  );
}

/** One month cell: negatives red, empty/zero an en-dash, comment → corner mark. */
function DataCell({
  value,
  hasComment,
  openable,
  onEdit,
}: {
  value: number | null;
  hasComment: boolean;
  openable: boolean;
  onEdit: (anchor: EditorAnchor) => void;
}) {
  const tone =
    value !== null && value < 0
      ? "text-negative"
      : value === null || value === 0
        ? "text-zero"
        : "text-ink-soft";
  const mark = hasComment ? (
    <span
      aria-label="Con comentario"
      className="absolute right-0 top-0"
      style={{ borderTop: "8px solid var(--color-warning)", borderLeft: "8px solid transparent" }}
    />
  ) : null;

  if (!openable) {
    return (
      <td
        className={cn(
          "relative border-b border-border-soft px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums",
          tone,
        )}
      >
        {mark}
        {formatAmount(value)}
      </td>
    );
  }

  return (
    <td className="relative border-b border-border-soft p-0">
      {mark}
      <button
        type="button"
        onClick={(event) => onEdit(anchorOf(event.currentTarget))}
        className={cn(
          "h-full w-full px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums transition-colors hover:bg-brand-soft",
          tone,
        )}
      >
        {formatAmount(value)}
      </button>
    </td>
  );
}

/** The read-only total column: derived, so it is never editable; bold on the result row. */
function TotalCell({ value, emphasized }: { value: number; emphasized: boolean }) {
  const tone = value < 0 ? "text-negative" : emphasized ? "text-brand" : "text-ink";
  return (
    <td
      className={cn(
        "border-b border-l border-border-soft px-4 py-2.5 text-right text-[13px] tabular-nums",
        emphasized ? "font-bold" : "font-semibold",
        tone,
      )}
    >
      {formatAmount(value)}
    </td>
  );
}

function anchorOf(el: HTMLElement): EditorAnchor {
  const rect = el.getBoundingClientRect();
  return { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right };
}

export const DatosTableRow = memo(DatosTableRowImpl);
