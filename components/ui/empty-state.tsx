import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Centered muted message for an empty list or dropdown panel. Optional `icon`
 * renders above the text. Sized for popover panels by default.
 */
export function EmptyState({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-4 py-6 text-center text-[12.5px] leading-relaxed text-faint",
        className,
      )}
    >
      {icon && <span className="text-faintest">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}
