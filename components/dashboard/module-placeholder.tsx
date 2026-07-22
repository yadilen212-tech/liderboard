import { findModuleBySlug } from "@/lib/modules";

export function ModulePlaceholder({ slug }: { slug: string }) {
  const mod = findModuleBySlug(slug);

  if (!mod) {
    return null;
  }

  const Icon = mod.icon;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Icon size={26} strokeWidth={1.8} />
      </div>
      <h2 className="text-lg font-semibold text-ink">{mod.title}</h2>
      <p className="max-w-sm text-sm text-muted">Este módulo estará disponible pronto.</p>
    </div>
  );
}
