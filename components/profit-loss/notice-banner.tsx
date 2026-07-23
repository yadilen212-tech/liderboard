"use client";

import { AlertTriangle, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Dismissible inline notice for the Datos view: parse errors (error) or sum-mismatch warnings (warning). */
export function NoticeBanner({
  tone,
  onDismiss,
  children,
}: {
  tone: "error" | "warning";
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "mb-3.5 flex items-start gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-[12.5px] leading-snug",
        tone === "error"
          ? "border-negative/40 bg-negative/5 text-negative"
          : "border-warning/50 bg-warning/10 text-ink",
      )}
    >
      <AlertTriangle size={15} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 text-current opacity-60 transition-opacity hover:opacity-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}
