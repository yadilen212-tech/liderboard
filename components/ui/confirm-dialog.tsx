"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Controlled confirmation modal built on the native <dialog> element (top-layer
 * stacking, native focus trap + Escape). The owner holds `open` and both handlers;
 * this primitive only syncs `open` to showModal()/close() and routes Escape and
 * backdrop clicks to onCancel. `busy` disables the actions and blocks dismissal so
 * an in-flight operation can't be cut short.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const cancelId = useId();
  const destructive = variant === "destructive";

  // Sync the controlled `open` prop to the native dialog's modal state. showModal()
  // handles top-layer stacking; we then move focus to the cancel button explicitly
  // (by id, not DOM order) so the safe action is the default regardless of layout.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      document.getElementById(cancelId)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, cancelId]);

  // Backdrop dismissal: a click whose target is the dialog element itself landed on
  // the ::backdrop. Bound imperatively (not via an onClick prop) so a11y lint rules
  // don't treat the dialog as a clickable non-interactive element.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    const onBackdropClick = (e: MouseEvent) => {
      if (e.target === dialog && !busy) {
        onCancel();
      }
    };
    dialog.addEventListener("click", onBackdropClick);
    return () => dialog.removeEventListener("click", onBackdropClick);
  }, [busy, onCancel]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        // Escape fires the native `cancel` event; keep React the source of truth
        // for closing (via `open`) and swallow it entirely while busy.
        e.preventDefault();
        if (!busy) {
          onCancel();
        }
      }}
      className="m-auto w-full max-w-[420px] border-none bg-transparent p-0 backdrop:bg-ink/40"
    >
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
        <div className="flex items-start gap-3">
          {destructive && <AlertTriangle size={20} className="mt-0.5 shrink-0 text-negative" />}
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <Button id={cancelId} variant="secondary" size="sm" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger-solid" : "primary"}
            size="sm"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
