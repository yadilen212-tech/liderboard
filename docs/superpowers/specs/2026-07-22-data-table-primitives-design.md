# Data-table component primitives (LiderPlus)

Date: 2026-07-22
Status: Approved

## Goal

Implement the reusable UI primitives that make up the "Datos" data tables of the
LiderPlus modules (Pérdidas y Ganancias, Sueldos por Áreas, Ocupaciones, Ventas),
translated from the approved `Dashboard LiderPlus.dc.html` design.

**Primitives only** — the low-level building blocks (cell, grid, buttons, selects,
dropdowns, search, chips). No assembled per-module tables. A standalone demo
gallery showcases each primitive live.

Desktop only. Speed and clean code are first-class constraints.

## Scope

In scope:

- Generic UI primitives: button, segmented control, select, search input,
  dropdown/popover, checkbox, filter chip, badge.
- Data-table primitives: grid shell, head cell, body cell (with numeric/sign
  tone + sticky columns), editable cell.
- Design-token additions in `app/globals.css`.
- Standalone demo gallery at `/docs/components` (outside the dashboard shell).

Out of scope (YAGNI): assembled PyG/Sueldos/Ocupaciones/Ventas tables, data
fetching, XLSX import/export, persistence, charts, mobile/responsive behavior,
new dependencies, a test runner.

## Decisions (confirmed with user)

- **Scope:** primitives only — not the 4 assembled tables.
- **Interactivity:** real, stateful components (dropdowns open/close with
  backdrop, selects/search controlled, chips removable, cells editable).
- **Demo placement:** standalone route `app/docs/components/` outside the
  `(dashboard)` route group — a storybook-style gallery, no sidebar/header.

## Design tokens (extend `@theme` in `app/globals.css`)

Existing tokens stay. Add (values taken verbatim from the design file):

| Token                    | Value     | Use                           |
| ------------------------ | --------- | ----------------------------- |
| `--color-surface-header` | `#FAFBFC` | grid header + sticky total bg |
| `--color-surface-muted`  | `#F8FAFC` | subtotal / group rows         |
| `--color-border-soft`    | `#EDF1F5` | inner row borders             |
| `--color-border-faint`   | `#F1F4F7` | light column dividers         |
| `--color-faintest`       | `#B4BEC9` | micro labels                  |
| `--color-zero`           | `#C2CBD5` | zero-value numerics           |
| `--color-positive`       | `#16A34A` | gains                         |
| `--color-negative`       | `#DC2626` | losses / remove               |
| `--color-chip`           | `#EEF2F6` | filter chip / avatar bg       |
| `--color-chip-border`    | `#DCE3EB` | filter chip border            |

Components use these as Tailwind utilities (`bg-surface-header`,
`text-negative`, …). No inline hex.

## Architecture

```
app/
  docs/components/
    page.tsx                 gallery (Client): section nav + live examples
    _sections/
      buttons.tsx            demo section per primitive group (Client)
      inputs.tsx             select + search
      dropdowns.tsx          dropdown + checkbox + chips
      data-grid.tsx          grid + cells + editable cell
components/
  ui/
    button.tsx               Button (pure)
    segmented-control.tsx    SegmentedControl (Client)
    select.tsx               Select (pure, controlled via props)
    search-input.tsx         SearchInput (Client)
    dropdown.tsx             Dropdown compound (Client)
    checkbox.tsx             Checkbox (pure)
    filter-chip.tsx          FilterChip + ChipBar (pure — handlers via props)
    badge.tsx                Badge (pure)
  data-table/
    data-grid.tsx            DataGrid shell + GridRow (pure)
    grid-cells.tsx           HeadCell + Cell (pure)
    editable-cell.tsx        EditableCell (Client)
lib/
  cn.ts                      (existing) className joiner
```

`"use client"` only where hooks are used. Pure primitives (Button, Cell,
HeadCell, Select, Badge, Checkbox, DataGrid) stay server-compatible.

## Component APIs

### `components/ui/`

- **`Button`** — `variant`: `primary | secondary | ghost | danger`; `size`:
  `sm | md`; `icon?` (Lucide, leading), `trailingIcon?`, `iconOnly?`. Renders a
  real `<button>`; forwards `type`, `onClick`, `disabled`, `aria-*`.
  - `primary`: `bg-brand text-white`, radius 9px. `secondary`: white + border.
    `ghost`: transparent, muted text. `danger`: `text-negative`.
- **`SegmentedControl`** — connected toggle. `options: {value,label}[]`, `value`,
  `onChange`. `variant`: `bar` (mode toggle: Todo el año / Mes / Rango) |
  `pills` (28px square level 1–6). Active segment = `bg-brand text-white`.
- **`Select`** — styled native `<select>` + chevron overlay. Props: `label?`,
  `value`, `onChange`, `options: {value,label}[]`, `size`. Border + radius-8.
- **`SearchInput`** — search icon + input. `size`: `md` (header) | `sm`
  (dropdown). Controlled `value`/`onChange`, `placeholder`. `readOnlyDisplay?`
  renders the static header pill variant.
- **`Dropdown`** (compound, self-managed open state; closes on backdrop click /
  outside click):
  - `Dropdown` — root (`relative`), holds open state.
  - `DropdownTrigger` — the filter button: `icon`, label (children), chevron,
    `active` styling (brand border + soft bg when a selection exists).
  - `DropdownPanel` — popover card: white, border, radius-12, shadow
    `0 14px 36px rgba(15,23,42,.16)`, `align`: `left | right`, `width?`. Renders
    a fixed-inset backdrop (`z-20`) behind the panel (`z-30`).
  - `DropdownOption` — checkbox row: box + optional `code` + `name`. `selected`,
    `onToggle`.
  - `DropdownFooter` — footer slot (e.g. "Quitar selección" / "Listo").
- **`Checkbox`** — small square box primitive. `checked`, `onChange`,
  indeterminate-free. Used by `DropdownOption` and standalone.
- **`FilterChip`** — `dotColor?`, label, `onRemove`. Rounded-full chip
  (`bg-chip border-chip-border text-brand`) with an 18px × remove circle.
  **`ChipBar`** — "Activos:" prefix + chips + "Limpiar todo" (danger) button.
- **`Badge`** — `variant`: `mono` (source pill, mono font) | `soft` | `outline`
  (uppercase "Próximamente"-style).

### `components/data-table/`

- **`DataGrid`** — `overflow-x-auto` wrapper + `<table>` (border-collapse,
  `w-full`, optional `minWidth`). Children are `<thead>`/`<tbody>` (or `GridRow`).
- **`GridRow`** — thin `<tr>` wrapper (optional `background` for
  subtotal/weekend rows).
- **`HeadCell`** — `<th>`. Props: `align`: `left | right`; `sticky`:
  `left | right`; `width?`. Styling: uppercase, 11px, weight 600, letter-spacing,
  `text-faint`, `bg-surface-header`, bottom border; sticky variant sets
  `position: sticky` + `z-index` + solid bg.
- **`Cell`** — `<td>`. Props: `align`; `numeric` (tabular-nums, right align);
  `sticky`: `left | right`; `strong` (bold total, `text-brand`); `tone`:
  `default | positive | negative | muted | auto`; `value?: number` — when
  `tone="auto"` the sign of `value` picks the color (neg → `text-negative`,
  0 → `text-zero`, pos → `default`); `background?` for weekend/zebra.
- **`EditableCell`** — `<td>` wrapping a controlled `<input>`: transparent
  border → brand ring on focus, right-aligned numeric, `value`/`onChange`,
  `placeholder`. Covers the Sueldos editable grid.

## Demo gallery (`/docs/components`)

- Standalone: inherits only the root layout (fonts, globals, `bg-canvas`); no
  sidebar/header.
- `page.tsx` (`"use client"`): a header, a sticky in-page section nav, and the
  section components. Each section renders live, interactive examples with
  hardcoded sample data (Spanish copy, e.g. "Ingresos", "Nómina", month
  columns), demonstrating every variant and state.
- Interactive proofs: a dropdown that opens and toggles checkboxes; a chip bar
  whose chips remove; a segmented control switching modes; a search input that
  filters a small list; a mini grid whose numeric cells recolor by sign and an
  editable Sueldos-style row.
- Sections split into `_sections/*.tsx` to keep `page.tsx` small and focused.

## Rendering / architecture notes

- Reuse `cn` from `lib/cn.ts`; icons from `lucide-react`; colors via tokens only.
- Pure primitives ship 0 client JS; interactive ones are minimal client islands.
- No new dependencies.

## Verification

`pnpm fmt` · `pnpm lint` · `pnpm build` (type-check) must pass.
