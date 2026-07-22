"use client";

import { ChevronDown } from "lucide-react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { cn } from "@/lib/cn";
import { Checkbox } from "@/components/ui/checkbox";

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext(component: string): DropdownContextValue {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error(`<${component}> must be rendered inside <Dropdown>.`);
  }
  return context;
}

/** Root: owns the open/closed state and positions its children. */
export function Dropdown({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className={cn("relative", className)}>{children}</div>
    </DropdownContext.Provider>
  );
}

/** The filter button: icon + label + chevron, with an `active` (has-selection) state. */
export function DropdownTrigger({
  icon,
  active = false,
  children,
}: {
  icon?: ReactNode;
  active?: boolean;
  children: ReactNode;
}) {
  const { open, setOpen } = useDropdownContext("DropdownTrigger");
  const highlighted = active || open;

  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={cn(
        "inline-flex h-[34px] items-center gap-2 rounded-[9px] border px-3 text-[12.5px] font-semibold transition-colors",
        highlighted
          ? "border-brand bg-brand-soft text-brand"
          : "border-border bg-surface text-muted hover:bg-canvas",
      )}
    >
      {icon}
      {children}
      <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
    </button>
  );
}

/** The popover card. Renders a full-screen backdrop that closes on click. */
export function DropdownPanel({
  align = "left",
  width,
  children,
}: {
  align?: "left" | "right";
  width?: number;
  children: ReactNode;
}) {
  const { open, setOpen } = useDropdownContext("DropdownPanel");
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-20 cursor-default"
      />
      <div
        role="menu"
        style={{ width }}
        className={cn(
          "absolute top-[calc(100%+8px)] z-30 rounded-xl border border-border bg-surface p-3 shadow-[0_14px_36px_rgba(15,23,42,0.16)]",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {children}
      </div>
    </>
  );
}

/** A selectable checkbox row: box + optional monospace code + name. */
export function DropdownOption({
  selected,
  onToggle,
  code,
  children,
}: {
  selected: boolean;
  onToggle: () => void;
  code?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-[9px] rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors",
        selected ? "bg-brand-soft font-medium text-brand" : "text-ink hover:bg-canvas",
      )}
    >
      <Checkbox checked={selected} size={17} />
      {code && <span className="font-mono text-[11px] text-faint">{code}</span>}
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
    </button>
  );
}

/** Footer slot separated by a hairline — e.g. "Quitar selección" / "Listo". */
export function DropdownFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1.5 flex items-center justify-between border-t border-border-soft pt-[9px]">
      {children}
    </div>
  );
}
