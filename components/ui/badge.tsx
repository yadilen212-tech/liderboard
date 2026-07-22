import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "mono" | "soft" | "outline";

const VARIANTS: Record<BadgeVariant, string> = {
  mono: "rounded-full border border-border bg-border-faint px-2 py-0.5 font-mono text-[10.5px] text-muted",
  soft: "rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.6px] text-brand",
  outline:
    "rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.6px] text-faint",
};

interface BadgeProps {
  /** `mono` = source pill; `soft` = filled tag; `outline` = "Próximamente"-style. */
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}

export function Badge({ variant = "soft", className, children }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center", VARIANTS[variant], className)}>{children}</span>
  );
}
