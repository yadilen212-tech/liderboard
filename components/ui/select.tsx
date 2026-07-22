import { ChevronDown } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  options: SelectOption[];
  /** Optional field label rendered above the control. */
  label?: ReactNode;
  size?: "sm" | "md";
}

export function Select({ options, label, size = "md", className, ...props }: SelectProps) {
  const control = (
    <div className="relative">
      <select
        className={cn(
          "w-full appearance-none rounded-lg border border-border bg-surface font-sans text-ink outline-none transition-colors focus:border-brand",
          size === "sm" ? "py-2 pl-2.5 pr-8 text-xs" : "py-2 pl-[9px] pr-9 text-[13px]",
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  );

  if (!label) {
    return control;
  }

  return (
    <label className="block text-[11px] font-semibold text-faint">
      {label}
      <span className="mt-1.5 block font-normal">{control}</span>
    </label>
  );
}
