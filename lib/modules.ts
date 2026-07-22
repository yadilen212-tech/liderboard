import { BedDouble, LineChart, Receipt, ShoppingBag, Users, type LucideIcon } from "lucide-react";

export interface DashboardModule {
  /** Route segment, e.g. "profit-loss". */
  slug: string;
  /** Sidebar navigation label. */
  label: string;
  /** Header title and breadcrumb leaf. */
  title: string;
  icon: LucideIcon;
}

export const MODULES: DashboardModule[] = [
  {
    slug: "profit-loss",
    label: "Pérdidas y Ganancias",
    title: "Pérdidas y Ganancias",
    icon: LineChart,
  },
  {
    slug: "salaries",
    label: "Sueldos por Áreas",
    title: "Sueldos por Áreas",
    icon: Users,
  },
  {
    slug: "occupancy",
    label: "Ocupaciones",
    title: "Ocupaciones · Análisis Hotelero",
    icon: BedDouble,
  },
  {
    slug: "sales",
    label: "Ventas",
    title: "Ventas · Análisis Comercial",
    icon: ShoppingBag,
  },
];

/** Module previewed in the sidebar but not yet available. */
export const COMING_SOON = { label: "Rol de Pagos", icon: Receipt } as const;

export const DEFAULT_MODULE = MODULES[0];

export function findModuleBySlug(slug: string | undefined): DashboardModule | undefined {
  return MODULES.find((module) => module.slug === slug);
}
