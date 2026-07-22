"use client";

import { cn } from "@/lib/cn";

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `bar` = connected mode toggle; `pills` = detached square level pills. */
  variant?: "bar" | "pills";
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = "bar",
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const isBar = variant === "bar";

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        isBar
          ? "inline-flex overflow-hidden rounded-lg border border-border"
          : "inline-flex gap-1.5",
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "font-semibold transition-colors",
              isBar
                ? cn(
                    "px-3 py-[7px] text-xs",
                    index < options.length - 1 && "border-r border-border",
                    active ? "bg-brand text-white" : "bg-surface text-muted hover:bg-canvas",
                  )
                : cn(
                    "flex h-7 w-7 items-center justify-center rounded-[7px] border text-xs",
                    active
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-surface text-muted hover:border-faint",
                  ),
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
