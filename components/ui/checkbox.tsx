import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface CheckboxProps {
  checked: boolean;
  /**
   * When provided the checkbox renders a real (visually-hidden) `<input>` on top
   * of the box. Omit it for a presentational box inside an already-clickable row.
   */
  onChange?: (checked: boolean) => void;
  size?: number;
  /** Applied to the underlying input so an external `<label htmlFor>` can bind it. */
  id?: string;
  ariaLabel?: string;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  size = 18,
  id,
  ariaLabel,
  className,
}: CheckboxProps) {
  const box = (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[5px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand",
        checked ? "border-brand bg-brand text-white" : "border-faint bg-surface text-transparent",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Check size={Math.round(size * 0.64)} strokeWidth={3} />
    </span>
  );

  if (!onChange) {
    return box;
  }

  return (
    <span className="relative inline-flex">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={ariaLabel}
        className="peer absolute inset-0 cursor-pointer opacity-0"
      />
      {box}
    </span>
  );
}
