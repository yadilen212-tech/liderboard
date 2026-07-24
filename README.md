# liderboard

**LiderPlus** — panel financiero para una firma contable. La interfaz está en **español**;
el código (identificadores, slugs de rutas) en **inglés**. Es una app **solo para escritorio**
(sin capa responsive/móvil).

## Stack

- [Next.js](https://nextjs.org) 16 — App Router, Server Components por defecto.
- Tailwind CSS v4 (CSS-first; el tema vive en `app/globals.css`, no hay `tailwind.config.js`).
- [oxc](https://oxc.rs) para lint y formato (`oxlint` / `oxfmt`) — no ESLint/Prettier.
- [Apache ECharts](https://echarts.apache.org) 6 para las gráficas, con _imports parciales_
  desde `echarts/core` y renderer SVG.
- Fuentes IBM Plex Sans/Mono vía `next/font`; iconos de `lucide-react`.
- Gestor de paquetes: **pnpm**.

## Puesta en marcha

```bash
pnpm install
pnpm dev            # servidor de desarrollo en http://localhost:3000
```

## Scripts

| Tarea                             | Comando          |
| --------------------------------- | ---------------- |
| Servidor de desarrollo (:3000)    | `pnpm dev`       |
| Build de producción (type-check)  | `pnpm build`     |
| Servir el build                   | `pnpm start`     |
| Lint                              | `pnpm lint`      |
| Lint + autofix                    | `pnpm lint:fix`  |
| Formato                           | `pnpm fmt`       |
| Verificar formato (CI)            | `pnpm fmt:check` |
| Tests (Vitest, solo la capa pura) | `pnpm test`      |

Tests con **Vitest**, solo sobre la capa pura de `lib/` (parse/derive/persistencia, el motor
analítico, la paleta y los constructores de opción de gráfica); no hay tests de componentes.

## Estructura

```
app/(dashboard)/        shell persistente (sidebar + header) y páginas de cada módulo
components/ui/           primitivas reutilizables (Button, Dropdown, SegmentedControl,
                         Toolbar, EmptyState, FilterChip, Checkbox, Select, …)
components/dashboard/    shell: sidebar, header, tabs de módulo
components/profit-loss/  composiciones específicas de Pérdidas y Ganancias
  └ charts/              tarjetas y vistas de Gráficos y Análisis
lib/modules.ts           registro de módulos (única fuente de verdad de la navegación)
lib/format.ts            helpers de formato de toda la app (moneda EC, número, porcentaje)
lib/date.ts              etiquetas de calendario compartidas (meses en español)
lib/charts/              paleta categórica y sistema de marcas, comunes a toda la app
lib/profit-loss/analytics/  motor analítico puro (series, transformaciones, Pareto, pastel)
lib/profit-loss/charts/  traducción pura: selección → consulta → opción de ECharts
docs/superpowers/specs/  specs de diseño aprobados
```

Las **funciones de formato son de toda la app**: cualquier número que se muestre al
usuario pasa por `lib/format.ts` (`formatCurrency` → USD de Ecuador con símbolo `$`) para
que todo el panel hable el mismo idioma. Los módulos nuevos las reutilizan en vez de
formatear localmente.

## Estado actual

Los módulos y su navegación salen de `lib/modules.ts`. Cada módulo expone las vistas
**Gráficos** y **Datos**; **Pérdidas y Ganancias** añade además **Análisis**.

**Pérdidas y Ganancias (PyG)** tiene su capa de filtros conectada a los datos:

- El **nombre del cliente activo** se muestra en el header del módulo (`ActiveClient`),
  con estado vacío mientras no se carga un Excel.
- **Sección de filtros** bajo las tabs: cuenta contable, **nivel** (único control de
  profundidad del árbol: expande/colapsa hasta el nivel elegido, o "Todos los niveles"; el
  máximo es el nivel más profundo de **todos** los archivos del workspace), centro de costos,
  granularidad (Ver por) y período. La lista de cuentas y los centros salen del Excel cargado;
  el estado vacío solo aparece cuando no hay datos.
- **Recuadro "Comparar por"** en Gráficos y Análisis (colapsable, cerrado por defecto), ya
  conectado al motor analítico (ver "Gráficos y Análisis" más abajo).
- Leyenda de **semáforo** en la fila de tabs.
- **Barra de acciones de Datos** (`DatosToolbar`, solo en la tab Datos, bajo la fila de
  filtros): barra **fija** de una fila con el selector de **Centro de costos** a la izquierda
  (solo en modo multi-centro; ver abajo) y las acciones de Excel a la derecha — **Cargar
  Excel** (abre el modal de carga multi-centro), menú **Descargar Excel** (Excel con tus datos
  · Plantilla vacía, ambos conectados al pipeline de exportación) e ícono de **información**
  con los formatos aceptados. (La profundidad del árbol se controla desde el filtro **nivel**
  de la fila de filtros; el drill-down por fila con los chevrons de la grilla sigue disponible.)

**Tabla de Datos de PyG** (`DatosView` en la tab Datos) — el estado de resultados editable:

- Componente **controlado por props y listo para el Excel**: sin datos muestra un **estado
  vacío** ("Carga un Excel…"); cuando llegan filas, arma la grilla. La carga y la descarga
  del Excel ya están implementadas (ver "Carga de Excel" y "Descarga de Excel" más abajo).
- Grilla con **árbol de cuentas** (expandir/colapsar), 12 meses + **Total**, **columnas
  ordenables**, negativos en rojo, ceros como `–` y marca de esquina en celdas con comentario.
- **Edición de celdas**: solo las **cuentas de movimiento** (hoja del árbol) editan su valor;
  las **cuentas padre** se calculan desde sus movimientos y solo admiten comentario. Ediciones
  y comentarios persisten en IndexedDB (Dexie) y solo están disponibles en la vista Mensual.
- **Selector de centro de costos** (`CostCenterTabs`, en la barra de acciones fija, solo en
  modo multi-centro): alterna entre el **Consolidado** (suma de los centros mensuales, solo
  lectura), cada **centro** (editable en vista Mensual) y **Sin centro de costo** (anual, solo
  lectura, tomado del archivo consolidado); un ícono de **información** explica esa semántica.
  Al vivir en la barra fija, no se va con el scroll de la tabla. El subtítulo del header nombra
  el centro activo.
- Rendimiento: filas memoizadas (`React.memo`), derivaciones con `useMemo` y
  `content-visibility` en las filas; sin virtualización (aún no hace falta).

Los importes usan el **formato de moneda de Ecuador** (`$`) vía `lib/format.ts`.

## Gráficos y Análisis (PyG)

Ambas pestañas consumen el **motor analítico** (`lib/profit-loss/analytics/`) a través de una
capa de traducción pura y testeada; ya no muestran "próximamente".

- **Reparto.** _Gráficos_ responde **cuánto y de qué** (montos por periodo, comparación entre
  cuentas y centros, composición de un total). _Análisis_ responde **cómo cambia**: las
  transformaciones del motor — acumulado YTD, índice base 100, media móvil, mismo periodo del
  año anterior, % sobre ingresos, % sobre la cuenta padre, variación y concentración de gastos.
- **Vista por defecto.** Con un Excel cargado ambas pestañas muestran algo útil **antes de
  configurar nada**: _Gráficos_ trae los totales del periodo como **stat tiles** (Ingresos,
  Costos y Gastos, Utilidad o Pérdida — un total es un número, no una gráfica de una barra), la
  evolución de Ingresos contra Costos y Gastos, la composición de los ingresos y el ranking de
  gastos; _Análisis_ trae el % sobre ingresos de los gastos principales, la variación contra el
  periodo anterior y el Pareto. Los presets son **consultas normales al motor**, la misma ruta
  que usa "Comparar" — no un camino aparte.
- **"Comparar por" conectada.** Sus cuatro dimensiones (`cuentas`, `centros`, `periodos`,
  `niveles`) se traducen a los ejes de `SeriesQuery`, con un cruce opcional ("Y también por")
  que agrega el segundo eje del producto cartesiano. El selector "Agregar" lista las cuentas
  del centro activo o los centros reales del workspace. Elegir una dimensión reemplaza la
  tarjeta de comparación y **conserva los stat tiles**; volver a «Nada» restaura el preset.
- **Estado compartido.** `PygAnalyticsProvider` (montado dentro de `PygDataProvider`, así que
  el layout no cambia) expone `usePygAnalytics()`: la barra de herramientas y el panel leen
  **una sola selección**. Vive **en memoria** — sobrevive al cambio entre Gráficos y Análisis,
  no al recargar — y se **sanea** al cambiar de workspace, de centro activo o de frecuencia:
  lo que dejó de existir se descarta y la pestaña vuelve a su vista por defecto.

**Reglas que las gráficas no rompen** (cada una con su test en la capa pura):

- **Ninguna gráfica lleva doble eje Y.** El combo de barras + línea comparte un solo eje y una
  sola unidad (monto con su media móvil, o con el mismo periodo del año anterior); lo que cambia
  de unidad va en su propia tarjeta. Por eso el **Pareto** se dibuja como barras horizontales
  ordenadas con el acumulado **como etiqueta**, y no con una segunda escala de porcentaje.
- **Los periodos sin cobertura no se dibujan.** Un `null` no produce marca ni se interpola (los
  archivos que llegan hasta julio no inventan un desplome en agosto); un **`0` real sí se
  dibuja**, y el tooltip omite la serie sin cobertura en vez de reportar `$0`.
- **El color sigue a la entidad, nunca a su posición.** La ranura sale del orden del centro en
  el selector (o de la cuenta en la consulta), así que quitar una serie no repinta las demás y
  un centro conserva su color entre tarjetas. La paleta tiene **ocho ranuras** validadas bajo
  daltonismo y **no se ciclan**: la consulta topa en 8 series y el motor avisa cuántas descartó.
  Verde y rojo quedan **reservados** para el signo de una variación, y siempre con flecha y
  valor con signo — nunca color solo.
- **Cada tarjeta tiene su gemela en tabla** ("Ver como tabla"): las mismas series como filas y
  los periodos como columnas, con los valores **ya transformados** (índice 100, variación, YTD)
  y el periodo sin cobertura en blanco. Las advertencias del motor salen **completas** antes de
  la gráfica, y una consulta sin series explica por qué en vez de dibujar un plot vacío.

**Renderizado.** `components/ui/chart.tsx` es el **único** que llama a `echarts.init`: monta la
instancia, aplica cada cambio de opción **sobre la instancia viva** (sin remontar, sin
parpadeo), la redimensiona con `ResizeObserver` (el sidebar colapsa sin disparar `resize` de
ventana) y la destruye al desmontar. Solo se registran `BarChart`, `LineChart`, `PieChart` y
los componentes de rejilla, tooltip, leyenda, etiquetas y línea de referencia; el paquete
completo ronda el megabyte y el chunk de `/profit-loss` entero pesa menos que eso.

## Carga de Excel (PyG › Datos)

- **Formatos soportados:** reporte mensual (con o sin línea "Centro de Costo"), reporte
  anual (solo columna Total) y el **consolidado por centros de costo** (columnas GENERAL +
  centros + Sin centro de costo, valores anuales).
- **Carga multi-centro (modal de staging):** "Cargar Excel" abre un modal donde arrastras o
  eliges **varios archivos a la vez**; cada uno se parsea al vuelo y se muestra con su rol
  detectado (centro / consolidado / estado único). Los archivos se agrupan por **contenido**
  (línea "Centro de Costo:" + empresa), **nunca por el nombre de archivo** — los reportes
  reales tienen nombres poco confiables. Los centros salen de las sucursales mensuales; el
  **Consolidado** se calcula sumándolas; el archivo consolidado aporta **Sin centro de costo**
  (anual) y valida los cuadres (`Σ centros + Sin-centro = GENERAL`, descuadre por cuentas de
  cada centro, y un aviso claro cuando un centro entra **vacío** —todo en 0— pero el
  consolidado sí trae datos, señal típica de haber cargado el archivo mensual equivocado). Los
  avisos salen en un banner **expandible** (`NoticeBanner`, con "Ver detalle" para leer cada
  mensaje) tanto en la vista Datos como en el preview del modal de carga.
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
  migraciones. Subir otro archivo reemplaza todo (con confirmación si hay ediciones); si
  el archivo fue exportado por la app, sus **comentarios se restauran** al recargarlo.
- **Decisión — edición solo en vista mensual:** editar valores y comentar celdas solo
  está disponible en la frecuencia Mensual, porque una celda agregada cubre varios
  meses y la edición sería ambigua. Si a futuro se quiere editar en vistas agregadas
  (p. ej. prorrateando entre meses), esta decisión es el punto a revisitar.

## Descarga de Excel (PyG › Datos)

- **Dos exportaciones** (menú "Descargar Excel"), generadas con **`exceljs`** (formato +
  notas de celda, que SheetJS no escribe), cargada por _dynamic import_ para no engordar el
  bundle inicial:
  - **Excel con tus datos:** el Estado de Resultados con los **valores editados** y los
    **comentarios** actuales, con formato (preámbulo, cabecera y cuentas padre en negrita,
    sangría por nivel, moneda a 2 decimales, columna Total, paneles congelados). Cada celda
    editada lleva una **nota** con `Valor original: $X → $Y` (más el comentario si lo hay);
    las celdas solo comentadas llevan su texto. Se exporta siempre en la **frecuencia base**.
    En **modo multi-centro** genera un libro con **una hoja por centro** (con sus ediciones y
    comentarios) + la hoja **Consolidado** (suma calculada) + **Sin centro de costo** si existe.
  - **Plantilla vacía:** la misma estructura **sembrada con tus cuentas** (código + nombre)
    y los montos en blanco, para llenar y volver a cargar.
- **Round-trip:** el archivo "con tus datos" se **vuelve a subir** sin error; los valores se
  conservan y los **comentarios se restauran**. El re-import usa una **hoja de metadatos
  oculta** (`_liderplus_meta`, `veryHidden`) con el texto exacto del comentario — no se
  parsea la prosa de las notas. Los value-edits no se "reviven": los valores editados quedan
  como nueva base.
- **`lib/download.ts`** expone `downloadBlob(blob, filename)`, reutilizable por cualquier módulo.
