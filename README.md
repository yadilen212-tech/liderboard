# liderboard

**LiderPlus** — panel financiero para una firma contable. La interfaz está en **español**;
el código (identificadores, slugs de rutas) en **inglés**. Es una app **solo para escritorio**
(sin capa responsive/móvil).

## Stack

- [Next.js](https://nextjs.org) 16 — App Router, Server Components por defecto.
- Tailwind CSS v4 (CSS-first; el tema vive en `app/globals.css`, no hay `tailwind.config.js`).
- [oxc](https://oxc.rs) para lint y formato (`oxlint` / `oxfmt`) — no ESLint/Prettier.
- Fuentes IBM Plex Sans/Mono vía `next/font`; iconos de `lucide-react`.
- Gestor de paquetes: **pnpm**.

## Puesta en marcha

```bash
pnpm install
pnpm dev            # servidor de desarrollo en http://localhost:3000
```

## Scripts

| Tarea                            | Comando          |
| -------------------------------- | ---------------- |
| Servidor de desarrollo (:3000)   | `pnpm dev`       |
| Build de producción (type-check) | `pnpm build`     |
| Servir el build                  | `pnpm start`     |
| Lint                             | `pnpm lint`      |
| Lint + autofix                   | `pnpm lint:fix`  |
| Formato                          | `pnpm fmt`       |
| Verificar formato (CI)           | `pnpm fmt:check` |

No hay runner de tests configurado.

## Estructura

```
app/(dashboard)/        shell persistente (sidebar + header) y páginas de cada módulo
components/ui/           primitivas reutilizables (Button, Dropdown, SegmentedControl,
                         Toolbar, EmptyState, FilterChip, Checkbox, Select, …)
components/dashboard/    shell: sidebar, header, tabs de módulo
components/profit-loss/  composiciones específicas de Pérdidas y Ganancias
lib/modules.ts           registro de módulos (única fuente de verdad de la navegación)
docs/superpowers/specs/  specs de diseño aprobados
```

## Estado actual

Los módulos y su navegación salen de `lib/modules.ts`. Cada módulo expone las vistas
**Gráficos** y **Datos**; **Pérdidas y Ganancias** añade además **Análisis**.

**Pérdidas y Ganancias (PyG)** ya tiene su capa de filtros (solo visual, sin lógica de datos):

- El **nombre del cliente activo** se muestra en el header del módulo (`ActiveClient`),
  con estado vacío mientras no se carga un Excel.
- **Sección de filtros** bajo las tabs: cuenta contable, nivel, centro de costos,
  granularidad (Ver por) y período. La lista de cuentas y los centros de costo se leen del
  Excel que se sube, por lo que hoy muestran un **estado vacío** listo para poblarse.
- **Recuadro "Comparar por"** en Gráficos y Análisis (colapsable, cerrado por defecto).
- Leyenda de **semáforo** en la fila de tabs.
- **Barra de acciones de Datos** (`DatosToolbar`, solo en la tab Datos, bajo la fila de
  filtros): filtro por cuentas mayores (grupo Todos/Ingresos/Costos, "Ocultar ceros",
  expandir a nivel 1–4/Todo) y acciones de Excel a la derecha — **Cargar Excel / ZIP**
  (botón listo para conectar), menú **Descargar Excel** (Excel con tus datos · Plantilla
  vacía) e ícono de **información** con los formatos aceptados. Todo visual; estado local.

El contenido de cada vista (gráficos, tablas, análisis) aún está en construcción.
