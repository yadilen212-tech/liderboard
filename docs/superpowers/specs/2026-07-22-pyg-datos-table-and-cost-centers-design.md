# PyG › Datos: data table + cost centers — design

**Date:** 2026-07-22
**Scope:** Build the Pérdidas y Ganancias **Datos** data table and the **cost-center**
tab strip. The table is prop-driven and Excel-ready; its default (no data) is an empty
state. Cell edit/comment editor is built but visual/local only. Cost-center tabs render
now with **mock** data as a preview scaffold. No real Excel parse, upload, download,
persistence, or cost-center detection.
**Design source:** `Dashboard LiderPlus.dc.html` (claude.ai/design project
`1fed77ae-29ff-439e-a0d1-f01e3b3abe5e`) — the `datosGrids` grid and the
`datosCCTabsOn` / `datosCCTabs` cost-center strip.
**Predecessor:** `2026-07-22-pyg-filters-and-header-client-design.md` (this picks up the
"data table itself" it left out of scope).

## Goal

1. Render the PyG **Datos** grid card(s) faithfully: header (dot + title + utilidad
   badge) → sticky-header table (`Cuenta` + 12 months + `Total`, sortable) → footer
   legend + row count.
2. Make the table a **pure, prop-driven** component that fills from Excel data later.
   With no rows it renders an **empty state** — that is the running-app default today.
3. Build the interactions the design shows — expand/collapse account tree, column sort,
   and a **cell edit/comment editor** — all visual / UI-local, active once rows exist.
4. Render the **cost-center tab strip** above the grid, driven by **mock** cost centers
   with a `FUTURE WORK` comment; detection that gates its visibility comes later.
5. Apply performance patterns: memoized rows, memoized derivations, `content-visibility`.

## Decisions (confirmed with user)

- **Table data now:** empty state. The component is complete underneath (tree, sort,
  editing); "empty" is just the no-data branch. Running app shows the empty state.
- **Interactions now:** expand/collapse + sort + **cell edit/comment** editor, all
  visual and local. No persistence.
- **Cost-center tabs now:** always visible with **mock** data + a `FUTURE WORK: detection`
  comment. The strip's real visibility gate (data has cost centers) is deferred.
- **Performance:** `React.memo` rows/cells + `useMemo` derivations + `content-visibility`.
  **No virtualization** (YAGNI — a P&L is tens of rows).
- **Fixtures:** a populated dataset lives in a clearly-marked `*.fixtures.ts` used to
  verify/screenshot the full grid; the page default stays empty.

## Reconciliation

The three answers coexist as follows: the table is one complete component whose empty
state is the default render (no Excel yet); its tree/sort/editing activate when rows
arrive; the cost-center strip is an always-on mock preview above it. So the running app
shows **mock cost-center tabs + empty-state table**, and the populated design is one
prop (the fixture) away.

## Data model — `components/profit-loss/datos-types.ts`

```ts
export interface DatosCell {
  value: number | null;
  comment?: string;
}

export interface DatosRow {
  code: string;
  name: string;
  level: number; // depth 1..n; drives indent
  isResult?: boolean; // the "Utilidad o Pérdida" summary row
  cells: DatosCell[]; // length === grid.months.length
  children?: DatosRow[]; // nested tree
}

export interface DatosGrid {
  id: string; // cost-center id, or "default"
  title: string;
  dotColor?: string; // cost-center color for the header dot
  utilidad?: { label: string; positive: boolean };
  months: string[]; // ["Ene" … "Dic"]
  rows: DatosRow[];
}

export interface CostCenter {
  id: string;
  name: string;
  color: string;
}
```

A **nested tree** (not the design's flat rows + parent pointers): expand/collapse and
rendering stay local and cheap, and Excel's code-prefixed hierarchy maps onto it at load
time. `cells[i]` aligns to `months[i]`; `Total` is derived (sum of non-null cells).

## Components — `components/profit-loss/`

### `datos-table.tsx` (client)

One grid card. Faithful styles from the `.dc.html`, using existing tokens:

- **Card:** `bg-surface`, `border-border`, `rounded-[13px]`, `overflow-hidden`, `mb-4`.
- **Header:** dot (`dotColor`) + title (`text-sm font-semibold`, ellipsis) on the left;
  **utilidad badge** on the right — green (`positive`) or red (`negative`) pill.
  `bg-surface-header`, `border-b border-border`, `px-[18px] py-3`.
- **Scroll area:** `overflow-auto max-h-[62vh] min-h-[180px]`.
- **Table:** `min-w-[960px]`, sticky `<thead>` (`bg-surface-header`, `top-0 z-[2]`):
  `Cuenta` (left, sortable) + 12 month columns (right, sortable) + `Total` (right,
  sortable). Sort arrow on the active column.
- **Footer:** legend — "Negativos en rojo" · "Celda con comentario" (warning triangle) ·
  "Clic en una celda para editar o comentar" — plus a mono **row count** on the right.
- **Empty state:** when `rows` is empty, render `<EmptyState>` inside the card body
  ("Carga un Excel para ver el estado de resultados"), no table chrome.

Props: `grid: DatosGrid`, sort state + handlers, collapsed set + toggle, and the
edit/comment callbacks (all owned by `datos-view`).

### `datos-table-row.tsx`

A `React.memo` row: chevron toggle (only when `children`), mono `code`, indent by
`level` (`paddingLeft = 14 + (level-1)*16`), name (ellipsis), then month + total cells.
Cell rendering: right-aligned tabular-nums; negative → `text-negative`; `0`/`null` →
`–` in `text-zero`; a `warning` comment-triangle mark (absolute, top-right) when the
cell has a comment. Cells are buttons that open the editor. Isolated so a single cell
edit re-renders one row, not the whole table.

### `cell-editor.tsx`

Lightweight popover anchored to the clicked cell: numeric value input + comment
textarea + Guardar / Cancelar. Local/visual only — writes to a local override map keyed
by `${rowCode}:${monthIndex}`; no persistence. (Future: writes back to the Excel model.)
Closes on backdrop click / Escape.

### `cost-center-tabs.tsx`

The "Centro de costos" pill-tab strip: uppercase micro-label + one pill per `CostCenter`
(colored dot + name; active pill brand-tinted) + an info hint line below. Driven by a
**mock** `CostCenter[]` for now with a `// FUTURE WORK: only render once uploaded data
is detected to contain cost centers` comment. `activeId` + `onSelect` lifted to
`datos-view` so the table shows the active center's grid.

### `datos-view.tsx` (client)

Composes `<CostCenterTabs>` + `<DatosTable>`. Owns UI-local state: active cost center,
sort (`{ key, dir }`), collapsed set, open editor cell, and the edit-override map.
Mounted **inside the panel scroll area** (`px-7 py-5` content padding, matching the
design's content region). Selects the active grid from its `grids: DatosGrid[]` prop
(mock/fixture today, empty by default → each grid shows the table empty state).

## Wiring — `components/dashboard/module-tabs.tsx`

The panel currently always renders `<ComingSoon>`. Change the panel body to:

```tsx
{
  isPyg && activeTab.id === "datos" ? <DatosView /> : <ComingSoon mod={mod} tab={activeTab} />;
}
```

`DatosToolbar` stays where it is (the band above the panel). No other tab or module
changes behavior.

## Performance patterns

- `React.memo` on `datos-table-row` (and the cell it renders); stable `code` keys.
- `useMemo` for `flatten(tree, collapsed)` then `sort`, keyed on
  `(rows, sortKey, sortDir, collapsed)`. Sorting a tree sorts siblings within each
  parent, then flattens honoring collapsed nodes.
- `content-visibility: auto` + `contain-intrinsic-size: <rowHeight>` on rows so the
  browser skips offscreen row layout/paint. No dependency.
- Editing state is one open cell + an override map; an edit re-renders the one affected
  row, not the table.
- Client boundary stays contained to `datos-view` and below.

## Tokens — `app/globals.css`

None required — `surface-header`, `border-soft`, `zero`, `positive`, `negative`,
`warning` already exist. Add one token only if it removes repeated hardcoding:
`--color-ink-soft: #334155` (table body text). Otherwise no `@theme` change.

## Reuse map

- `EmptyState` (`components/ui/empty-state.tsx`) → table empty state.
- Existing tokens (`bg-surface-header`, `text-negative`, `text-zero`, …) → all styling.
- `cn` (`lib/cn`) → conditional classes.
- `lucide-react` → `ChevronRight`/`ChevronDown` (tree), `ArrowUpDown`/`ArrowUp`/`ArrowDown`
  (sort), `MousePointerClick` (footer legend), `Info` (cost-center hint).

## Out of scope

Real Excel parse/upload/download, persistence of edits/comments, cost-center
**detection** (the strip's real visibility gate), the Análisis and Gráficos tab content,
non-PyG modules.

## Docs to update at the end

- `CLAUDE.md` — one line under the Components section: PyG › Datos owns a prop-driven,
  Excel-ready data table + a (mock, preview) cost-center tab strip. Keep it lean.
- `README.md` — extend with what was built (Datos table, cost-center tabs, editing).
