import { Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FilterChipProps {
  label: ReactNode;
  /** Optional leading swatch color (CSS color string). */
  dotColor?: string;
  onRemove?: () => void;
}

export function FilterChip({ label, dotColor, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-chip-border bg-chip py-1 pl-[11px] pr-1 text-xs font-semibold text-brand">
      {dotColor && <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: dotColor }} />}
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar filtro"
          className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white/70 text-muted transition-colors hover:text-negative"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}

interface ChipBarProps {
  children: ReactNode;
  onClearAll?: () => void;
  className?: string;
}

/** "Activos: [chips] Limpiar todo" row that hosts the active `FilterChip`s. */
export function ChipBar({ children, onClearAll, className }: ChipBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-[11px] font-semibold tracking-[0.3px] text-faintest">Activos:</span>
      {children}
      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex items-center gap-1.5 px-1 py-1 text-xs font-semibold text-negative"
        >
          <Trash2 size={13} />
          Limpiar todo
        </button>
      )}
    </div>
  );
}
