"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

interface SearchInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** `md` = header-sized; `sm` = compact (inside dropdowns). */
  size?: "sm" | "md";
  /** Render a static, non-editable pill (the header search affordance). */
  readOnlyDisplay?: boolean;
  className?: string;
}

export function SearchInput({
  value = "",
  onChange,
  placeholder = "Buscar…",
  size = "md",
  readOnlyDisplay = false,
  className,
}: SearchInputProps) {
  const md = size === "md";
  const textClass = md ? "text-[13px]" : "text-xs";

  return (
    <div
      className={cn(
        "flex items-center border border-border bg-canvas text-faint",
        md ? "gap-[9px] rounded-[9px] px-[13px] py-[9px]" : "gap-2 rounded-lg px-2.5 py-[7px]",
        className,
      )}
    >
      <Search size={md ? 16 : 14} className="shrink-0" />
      {readOnlyDisplay ? (
        <span className={textClass}>{placeholder}</span>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full border-none bg-transparent font-sans text-ink outline-none placeholder:text-faint",
            textClass,
          )}
        />
      )}
    </div>
  );
}
