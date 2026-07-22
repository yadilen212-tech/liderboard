import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface DataGridProps {
  children: ReactNode;
  /** Force a horizontal scroll threshold (px). Columns below it stay pinned. */
  minWidth?: number;
  className?: string;
}

/** Scroll container + `<table>` shell. Compose `<thead>`/`<tbody>` (or `GridRow`) inside. */
export function DataGrid({ children, minWidth, className }: DataGridProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className={cn("w-full border-collapse", className)} style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

interface GridRowProps {
  children: ReactNode;
  /** Tints the row (subtotal / group rows). */
  muted?: boolean;
  className?: string;
}

export function GridRow({ children, muted, className }: GridRowProps) {
  return <tr className={cn(muted && "bg-surface-muted", className)}>{children}</tr>;
}
