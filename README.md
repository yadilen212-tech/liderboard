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
lib/format.ts            helpers de formato de toda la app (moneda EC, número, porcentaje)
lib/date.ts              etiquetas de calendario compartidas (meses en español)
docs/superpowers/specs/  specs de diseño aprobados
```

Las **funciones de formato son de toda la app**: cualquier número que se muestre al
usuario pasa por `lib/format.ts` (`formatCurrency` → USD de Ecuador con símbolo `$`) para
que todo el panel hable el mismo idioma. Los módulos nuevos las reutilizan en vez de
formatear localmente.

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

**Tabla de Datos de PyG** (`DatosView` en la tab Datos) — el estado de resultados editable:

- Componente **controlado por props y listo para el Excel**: sin datos muestra un **estado
  vacío** ("Carga un Excel…"); cuando llegan filas, arma la grilla. La carga/descarga real
  del Excel es trabajo posterior.
- Grilla con **árbol de cuentas** (expandir/colapsar), 12 meses + **Total**, **columnas
  ordenables**, negativos en rojo, ceros como `–` y marca de esquina en celdas con comentario.
- **Edición de celdas**: solo las **cuentas de movimiento** (hoja del árbol) editan su valor;
  las **cuentas padre** se calculan desde sus movimientos y solo admiten comentario. Todo
  local/visual por ahora.
- **Pestañas de centro de costos** sobre la grilla — hoy con datos **mock** (siempre visibles
  como vista previa); su aparición real dependerá de detectar centros en el Excel (pendiente).
- Rendimiento: filas memoizadas (`React.memo`), derivaciones con `useMemo` y
  `content-visibility` en las filas; sin virtualización (aún no hace falta).

Los importes usan el **formato de moneda de Ecuador** (`$`) vía `lib/format.ts`.

El contenido de Gráficos y Análisis aún está en construcción.
