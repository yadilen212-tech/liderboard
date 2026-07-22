const ITEMS: { label: string; color: string }[] = [
  { label: "Favorable", color: "var(--color-positive)" },
  { label: "Desfavorable", color: "var(--color-negative)" },
  { label: "Alerta", color: "var(--color-warning)" },
  { label: "Neutro", color: "var(--color-faint)" },
];

/** Color legend shown on the PyG tab row: what each semáforo swatch means. */
export function Semaforo() {
  return (
    <div className="flex flex-wrap items-center gap-4 pb-[11px]">
      <span className="text-[10.5px] font-semibold tracking-[0.6px] text-faintest">SEMÁFORO</span>
      {ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <span className="h-[9px] w-[9px] rounded-[3px]" style={{ backgroundColor: item.color }} />
          {item.label}
        </div>
      ))}
    </div>
  );
}
