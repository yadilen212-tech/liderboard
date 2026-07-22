import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A titled gallery section with an anchor id for the in-page nav. */
export function DocSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {description && (
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p>
      )}
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  );
}

/** A labeled example surface inside a section. */
export function Demo({
  label,
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div>
      {label && (
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.5px] text-faintest">
          {label}
        </div>
      )}
      <div
        className={cn(
          "flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface p-6",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
