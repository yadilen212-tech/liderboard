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

| Tarea                                | Comando          |
| ------------------------------------ | ---------------- |
| Servidor de desarrollo (:3000)       | `pnpm dev`       |
| Build de producción (type-check)     | `pnpm build`     |
| Servir el build                      | `pnpm start`     |
| Lint                                 | `pnpm lint`      |
| Lint + autofix                       | `pnpm lint:fix`  |
| Formato                              | `pnpm fmt`       |
| Verificar formato (CI)               | `pnpm fmt:check` |
| Tests (Vitest, solo lib/profit-loss) | `pnpm test`      |

Tests con **Vitest**, solo sobre la capa pura `lib/profit-loss/` (parse/derive/persistencia);
no hay tests de componentes.

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

**Pérdidas y Ganancias (PyG)** ya tiene su capa de filtros (solo visual, salvo el selector de
frecuencia, que sí controla los datos mostrados):

- El **nombre del cliente activo** se muestra en el header del módulo (`ActiveClient`),
  con estado vacío mientras no se carga un Excel.
- **Sección de filtros** bajo las tabs: cuenta contable, nivel, centro de costos,
  granularidad (Ver por) y período. La lista de cuentas y los centros de costo se leen del
  Excel que se sube, por lo que hoy muestran un **estado vacío** listo para poblarse.
- **Recuadro "Comparar por"** en Gráficos y Análisis (colapsable, cerrado por defecto).
- Leyenda de **semáforo** en la fila de tabs.
- **Barra de acciones de Datos** (`DatosToolbar`, solo en la tab Datos, bajo la fila de
  filtros): filtro por cuentas mayores (grupo Todos/Ingresos/Costos, "Ocultar ceros",
  expandir a nivel 1–4/Todo) y acciones de Excel a la derecha — **Cargar Excel** (conectado
  al pipeline real de carga), menú **Descargar Excel** (Excel con tus datos · Plantilla
  vacía) e ícono de **información** con los formatos aceptados.

**Tabla de Datos de PyG** (`DatosView` en la tab Datos) — el estado de resultados editable:

- Componente **controlado por props y listo para el Excel**: sin datos muestra un **estado
  vacío** ("Carga un Excel…"); cuando llegan filas, arma la grilla. La carga real del Excel
  ya está implementada (ver "Carga de Excel" más abajo); la descarga/exportación sigue
  pendiente.
- Grilla con **árbol de cuentas** (expandir/colapsar), 12 meses + **Total**, **columnas
  ordenables**, negativos en rojo, ceros como `–` y marca de esquina en celdas con comentario.
- **Edición de celdas**: solo las **cuentas de movimiento** (hoja del árbol) editan su valor;
  las **cuentas padre** se calculan desde sus movimientos y solo admiten comentario. Ediciones
  y comentarios persisten en IndexedDB (Dexie) y solo están disponibles en la vista Mensual.
- **Pestañas de centro de costos** sobre la grilla — hoy **desactivadas** (no se renderizan);
  los archivos consolidados por centro de costo se rechazan al parsear. Vuelven con el hito
  de centros de costo.
- Rendimiento: filas memoizadas (`React.memo`), derivaciones con `useMemo` y
  `content-visibility` en las filas; sin virtualización (aún no hace falta).

Los importes usan el **formato de moneda de Ecuador** (`$`) vía `lib/format.ts`.

El contenido de Gráficos y Análisis aún está en construcción.

## Carga de Excel (PyG › Datos)

- **Formatos soportados:** reporte mensual (con o sin línea "Centro de Costo") y reporte
  anual (solo columna Total) del sistema contable. El **consolidado por centros de
  costo** se detecta y rechaza con un mensaje — su soporte llega con el hito de centros
  de costo.
- **Mapeo genérico:** el parser lee el esqueleto (preámbulo → cabecera → filas
  `código, nombre, valores` → fila Utilidad), no un plan de cuentas fijo. Las sumas de
  cuentas padre y la fila "Utilidad o Pérdida" (raíces 4 − raíces 5) **siempre se
  recalculan desde las cuentas de movimiento**; los valores del archivo solo validan el
  parseo (los descuadres se avisan).
- **Frecuencias:** el archivo define la frecuencia base y la vista puede agregar hacia
  arriba (mensual → trimestral → semestral → anual, sumas de períodos); nunca se
  desagrega. Un archivo anual queda bloqueado en Anual.
- **Persistencia:** IndexedDB (Dexie). El dataset original y las ediciones/comentarios
  viven en tablas separadas — la comparación "original vs editado" llegará sin
  migraciones. Subir otro archivo reemplaza todo (con confirmación si hay ediciones).
- **Decisión — edición solo en vista mensual:** editar valores y comentar celdas solo
  está disponible en la frecuencia Mensual, porque una celda agregada cubre varios
  meses y la edición sería ambigua. Si a futuro se quiere editar en vistas agregadas
  (p. ej. prorrateando entre meses), esta decisión es el punto a revisitar.
