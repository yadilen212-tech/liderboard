# PyG filter section + client name in header — design

**Date:** 2026-07-22
**Scope:** Visual only. No data logic, no persistence. UI-local state (open/close, active
segment) is allowed; nothing is wired to real data.
**Design source:** `Dashboard LiderPlus.dc.html` (claude.ai/design project
`1fed77ae-29ff-439e-a0d1-f01e3b3abe5e`), filter iteration **"3a"** (two zones: Filtrar /
Comparar).

## Goal

1. Move the active-client name out of the sidebar and into the module header, matching the
   design (Pérdidas y Ganancias only).
2. Render the PyG **filter section** under the tabs for all three tabs (Gráficos, Datos,
   Análisis) — only the filter chrome, not the chart/table/analysis content.
3. Render the collapsible **Comparar** box, which appears only in Gráficos and Análisis.
4. Reuse existing primitives; add missing ones as reusable components. The Cuenta filter
   list comes from an uploaded Excel — build it Excel-ready but render an **empty state**
   for now.

## Decisions (confirmed with user)

- **Exportar button:** removed. The design's header right side is the client block; there
  is no Exportar button in the design.
- **Comparar box:** collapsed by default. Only the "Comparar" toggle button shows in the
  filter row (Gráficos/Análisis); clicking it reveals the box.
- **Semáforo legend:** included, on the right of the PyG tab row.

## Changes

### Sidebar — `components/dashboard/sidebar.tsx`

Delete the entire "Cliente activo" card (the `Hotel` / `FileSpreadsheet` block). Keep the
`© 2026 LiderPlus · v0.1` footer. Remove now-unused `Hotel` / `FileSpreadsheet` imports.

### Header — `components/dashboard/header.tsx`

Remove the `Exportar` button and its `Download` import. For `profit-loss` only, render a
right-aligned `ActiveClient`:

- Line 1: empresa name — bold, ellipsis, `max-width:360px`. No data → **"Sin cliente
  seleccionado"**.
- Line 2: muted subline **"Estado de resultados · Datos de ejemplo"**.

`ActiveClient` accepts an optional `client` prop (name + optional subline) so it is
Excel-ready; with no prop it renders the empty state above.

### Tabs shell — `components/dashboard/module-tabs.tsx`

For `profit-loss` only:

- Add `<Semaforo />` to the right of the tab row (row becomes tabs-left / legend-right).
- Render `<PygToolbar activeTab={activeTab.id} />` between the tab row and the panel.

The content panel keeps rendering `ComingSoon` (no chart/table/analysis content in scope).

### PyG filter section — `components/profit-loss/`

**`pyg-toolbar.tsx`** (client) — composes the FILTROS row and owns which popover / the
compare box is open. Given `activeTab: ModuleTabId`:

- `ToolbarLabel` "Filtros" (sliders-horizontal icon)
- `AccountFilter` (Cuenta contable)
- Nivel dropdown — static: Todos, Nivel 1–4 (inline, trivial)
- Centro de costos dropdown — empty state (inline, trivial)
- `Comparar` toggle button — Gráficos + Análisis only
- spacer
- `ToolbarLabel` "Ver por" + `SegmentedControl` — Mensual / Trimestral / Semestral
- `PeriodFilter` (Periodo)

Below the row, `CompareBar` renders only for Gráficos/Análisis and only when the Comparar
toggle is open.

**`account-filter.tsx`** — Cuenta dropdown: `SearchInput` (sm) + list, or `EmptyState`
when the list is empty. Signature `accounts?: AccountOption[]` where
`AccountOption = { code: string; name: string }`. Empty for now; ready to receive Excel
data.

**`period-filter.tsx`** — Periodo dropdown: mode toggle (Todo el año / Mes / Rango) +
month grid (Ene–Dic) + range selects. Visual only; local mode state.

**`compare-bar.tsx`** — the COMPARAR POR box. `ToolbarLabel` "Comparar por" +
`SegmentedControl` of dimensions: **Nada / Cuentas / Centros / Periodos / Niveles**
(default Nada). When dimension ≠ Nada: series chips + "Agregar" (empty-state popover) +
cruce ("y también por") dropdown + count hint. Sits on the sunken toolbar tone.

**`semaforo.tsx`** — legend: Favorable (positive) · Desfavorable (negative) · Alerta
(warning) · Neutro (faint).

### New reusable primitives — `components/ui/`

**`toolbar.tsx`**

- `Toolbar` — horizontal row container: `flex flex-wrap items-center gap-2.5 px-7 py-3`,
  `tone?: "surface" | "sunken"` (sunken = `--color-surface-sunken`, top hairline).
- `ToolbarLabel` — uppercase micro-label (`text-[10.5px] font-semibold tracking wide
text-faint`) with optional leading icon.

**`empty-state.tsx`**

- `EmptyState` — centered muted message with optional icon; used inside dropdown panels
  and empty lists. Props: `icon?`, `children`, `className?`.

### Tokens — `app/globals.css`

Add to the `@theme` block:

- `--color-warning: #d97706` (Semáforo "Alerta").
- `--color-surface-sunken: #f3f6f9` (compare-row / sunken toolbar background).

## Per-tab behavior

| Tab      | Filters row | Comparar button + box |
| -------- | ----------- | --------------------- |
| Gráficos | yes         | yes                   |
| Datos    | yes         | no                    |
| Análisis | yes         | yes                   |

## Reuse map

- `Dropdown` / `DropdownTrigger` / `DropdownPanel` / `DropdownOption` / `DropdownFooter`
  → Cuenta, Nivel, Centro de costos, Periodo, Agregar-series popover.
- `SegmentedControl` → Ver por (granularity), Comparar por (dimensions).
- `FilterChip` / `ChipBar` → series chips (compare box).
- `SearchInput`, `Checkbox`, `Badge`, `Button`, `Select` → as needed inside the above.

## Out of scope

Chart/table/analysis content; export logic; real Excel parsing; filter state/persistence;
non-PyG modules keep their current behavior (no filter section, no client block).

## Docs to update at the end

- `CLAUDE.md` — minimal: note the `components/profit-loss/` layer and that PyG owns a
  filter section + header client block. Keep it lean (orientation only).
- `README.md` — extend with what was built.
