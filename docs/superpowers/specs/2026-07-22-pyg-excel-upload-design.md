# PyG: functional Excel upload, account mapping & frequency switching — design

**Date:** 2026-07-22
**Scope:** Make the PyG **Datos** Excel upload real: parse `.xls`/`.xlsx` with SheetJS,
map any chart of accounts sharing the sample skeleton into the account tree, recompute
parent sums from movement (leaf) accounts, compute the Utilidad row, switch frequency
(Mensual/Trimestral/Semestral/**Anual**) with correct aggregation, persist the dataset
and its edits separately in IndexedDB via **Dexie**, and fill the header `ActiveClient`
from the file's metadata. **No cost-center UI yet** — the mock tab strip gets gated off.
**Predecessor:** `2026-07-22-pyg-datos-table-and-cost-centers-design.md` (built the
prop-driven table this feeds).

## Goal

1. The "Cargar Excel" button parses a real accounting-system export client-side and the
   Datos table, frequency control, and header client name all fill from it.
2. Parsing is **generic**: driven by the file skeleton (preamble → header row →
   `[code, name, …values]` rows → trailing result row), not by a hardcoded chart of
   accounts. Sample files differ in accounts/names; the skeleton is the contract.
3. Parent accounts always derive from their movement accounts; the file's parent values
   only validate the parse. Editing a leaf re-derives parents and Utilidad.
4. Frequency switching aggregates monthly data correctly (P&L is a flow statement, so
   period sums are the correct aggregation) and the file's base frequency floors the
   selectable options.
5. Original data and user edits are stored **separately** (Dexie tables) so a future
   "original vs edited" comparison feature needs no migration.

## Decisions (confirmed with user)

- **Persistence:** IndexedDB via **Dexie** (+ `dexie-react-hooks`). Uploaded dataset and
  edits survive reloads. Original values and edits live in separate tables because a
  compare-original-vs-edits feature comes later.
- **Parent sums:** always recomputed from leaves. File parent values validate the parse
  (mismatch ⇒ warning, computed value wins).
- **Utilidad row:** computed as (roots with code starting `4`) − (roots starting `5`) —
  expenses are stored positive in the source system. The file's own Utilidad row is
  validation-only. Roots outside `4*`/`5*` are excluded from the result with a warning.
- **Editing across frequencies:** value edits **and** comments only in the Mensual view
  (an aggregated cell spans several months, so a cell edit would be ambiguous). Outside
  Mensual, cells do not open the editor. **This decision must be documented in
  README.md** so the "allow aggregated editing" path can be revisited deliberately.
- **Sucursal files** ("Centro de Costo: X" preamble line) are accepted and treated as a
  plain monthly statement; the center name is kept as dataset metadata.
- **Consolidated cost-center files** (columns = GENERAL + center names, annual values)
  are **detected and rejected** with a clear Spanish message (support arrives with the
  cost-center milestone).
- **Base frequency floors the control:** an annual-only file (single `Total` column)
  loads locked to Anual; a monthly file enables all four. Lower-than-base options are
  disabled — you can aggregate up, never disaggregate down.
- **Detection today covers mensual + anual bases only.** No quarterly/semestral sample
  exists; the model stores `baseFrequency` so a new detector slots in without touching
  the rest. Do not guess at unseen header shapes.
- **ZIP is out of scope.** Button copy becomes "Cargar Excel"; the info tooltip drops
  the ZIP mention.
- **Toolbar filters stay visual** (grupo, ocultar ceros, expandir, nivel, período) — a
  follow-up spec wires them.
- **Tests:** add **Vitest** for the pure `lib/profit-loss/` layer (see Testing).
- **Clean code is a stated requirement** (see Clean code).

## Source format contract (from `.context/DOCS_CONTEXTO_PyG/` samples)

`.context` is git-ignored (client data) — the spec records the contract here so the repo
never depends on those files existing.

All formats share one skeleton on the **first worksheet** (sheet name varies:
"Consulta Personas", "Reporte"):

```
row 0   [company name]                          ← first non-empty preamble row
row 1   ["Estado de Resultados"]
        ["Centro de Costo: X"]                  ← only in sucursal files
        ["Desde el 01/01/2026 hasta el 31/12/2026"]  ← absent in consolidated files
        …blank rows…
header  [null, null, <value column labels…>]
        …blank rows…
data    [code, name, …values]                   ← code is dot-separated: "4", "4.1.1.2.1"
        …
result  [null, "Utilidad o Pérdida", …values]   ← no code; name may lack the accent
```

Value column labels classify the format:

| Labels (col C onward)                        | Format                      | Action                         |
| -------------------------------------------- | --------------------------- | ------------------------------ |
| Month names (`Enero`…`Diciembre`) + `Total`  | Monthly (base mensual)      | Parse                          |
| `Total` only                                 | Annual (base anual)         | Parse, lock frequency to Anual |
| Other text labels (`GENERAL`, center names…) | Consolidated by cost center | Reject: "no soportado aún"     |

Facts the parser must honor:

- **Header row position is not fixed** (the sucursal preamble line shifts it). Detect it:
  the first data row is the first row whose col A matches `/^\d+(\.\d+)*$/` with a
  non-empty col B; the header row is the nearest row above it with any non-empty cell at
  column index ≥ 2.
- Hierarchy depth varies per branch (leaves exist at level 3 and at level 5 in the same
  file). Leaf = a code no other code extends.
- Values are numbers (may be negative, e.g. "Rebaja y/o Descuentos"). Expenses positive.
- The trailing result row has values even in months where income rows are all zero.
- Month labels map by **name** (accent/case-insensitive) to month index 0–11. If fewer
  than 12 month columns appear, missing months become `0` and a warning is recorded.
- The file's `Total` column and parent/result values are **read for validation only**;
  every displayed total/parent/result is recomputed.

## Data model & persistence — `lib/profit-loss/`

New directory for the pure, non-UI layer. All functions here are pure (no React, no
DOM) except `db.ts`.

### `types.ts`

```ts
export type Frequency = "mensual" | "trimestral" | "semestral" | "anual";

/** One account row exactly as parsed — original values, never mutated. */
export interface AccountRow {
  code: string;
  name: string;
  /** Monthly base: length 12 (month index 0–11). Annual base: length 1. */
  values: number[];
}

export interface PygDataset {
  id: string; // crypto.randomUUID()
  fileName: string;
  uploadedAt: number; // epoch ms
  companyName: string;
  periodLabel: string; // "Ene–Dic 2026" — built with MONTHS_SHORT_ES
  year: number | null; // null when no date-range preamble line exists
  baseFrequency: Frequency; // "mensual" | "anual" today
  costCenterName?: string; // sucursal files
  accounts: AccountRow[]; // flat, in file order, parents included (original values)
  resultFromFile: number[]; // the file's Utilidad row, validation/comparison only
  warnings: string[]; // Spanish, human-readable parse/validation notes
}

/** A user edit overlay — never mutates AccountRow.values. */
export interface CellEdit {
  id?: number;
  datasetId: string;
  code: string;
  monthIndex: number; // base-frequency column index (month for mensual base)
  value?: number; // only for leaf accounts
  comment?: string;
  updatedAt: number;
}
```

### `db.ts` — Dexie

```ts
db.version(1).stores({
  datasets: "id",
  edits: "++id, datasetId, &[datasetId+code+monthIndex]",
});
```

- Exactly **one** dataset at a time: uploading runs one Dexie transaction that clears
  `datasets` + `edits` and inserts the new dataset. If edits exist for the current
  dataset, the UI asks for confirmation first (native `confirm()` with Spanish copy —
  deliberate simplicity; upgrade to a styled dialog later if wanted).
- An edit with both `value` and `comment` empty is **deleted**, not stored.
- The compound unique index makes save-edit an upsert (`db.edits.put` after lookup).

## Parsing — `lib/profit-loss/parse.ts`

Public API: `parsePygWorkbook(data: ArrayBuffer, fileName: string): PygDataset` —
throws `PygParseError` on rejection. A thin `parsePygFile(file: File)` wrapper reads the
`ArrayBuffer` and dynamically imports SheetJS.

Pipeline (each step its own small function):

1. **Read workbook** — `XLSX.read(data)`; take the **first** worksheet;
   `sheet_to_json(ws, { header: 1, raw: true, defval: null })` → `Cell[][]`.
2. **Locate first data row** (code regex above). None ⇒ `PygParseError("no-accounts")`.
3. **Locate header row** (nearest row above with a non-empty cell at index ≥ 2). None ⇒
   `PygParseError("no-header")`.
4. **Classify columns** from header labels: month name → `{ kind: "month", monthIndex }`;
   `total` → total column; any other text ⇒ `PygParseError("consolidated-unsupported")`.
   Base frequency: any month columns ⇒ `mensual` (missing months zero-filled + warning);
   only `Total` ⇒ `anual`.
5. **Parse preamble** (rows above header): company = first non-empty col A;
   `Centro de Costo: X` → `costCenterName`;
   `Desde el dd/mm/yyyy hasta el dd/mm/yyyy` → `year` + `periodLabel`
   (month-range built from the two dates via `MONTHS_SHORT_ES`; missing ⇒ `year: null`,
   `periodLabel: "—"`).
6. **Parse account rows**: for each row from the first data row down — code cell matches
   the regex ⇒ `AccountRow` (values from classified columns; non-numeric ⇒ `0` +
   warning). Codeless row whose name matches `/utilidad|p[ée]rdida/i` ⇒ `resultFromFile`.
   Duplicate code ⇒ keep the first, warn.
7. **Validate** (see Derivation): recompute parents + result from leaves; any cell
   differing from the file's value by more than **$0.01** ⇒ one warning naming the
   account code/column. Computed values win everywhere in the UI.

`PygParseError` carries a `code`
(`"invalid-file" | "no-accounts" | "no-header" | "consolidated-unsupported"`) and a
user-facing Spanish `message` (e.g. consolidated ⇒ "Este archivo es un consolidado por
centros de costo; ese formato estará disponible próximamente. Sube el reporte mensual.").
Unexpected exceptions from SheetJS map to `invalid-file`.

**SheetJS install:** the npm registry's `xlsx` is frozen at 0.18.5 with known
advisories; install the official CDN tarball pinned in `package.json`
(`"xlsx": "https://cdn.sheetjs.com/xlsx-<latest 0.20.x>/xlsx-<version>.tgz"` — resolve
the exact current version at implementation time). Import it **dynamically** inside the
upload path only, so it never enters the initial bundle.

## Derivation — `lib/profit-loss/derive.ts`

Pure functions from `(PygDataset, CellEdit[], Frequency)` to what the UI renders:

1. **`buildAccountTree(accounts)`** — nodes linked by dot-prefix (parent of `4.1.1` is
   `4.1`). A missing immediate parent attaches the node to its nearest existing ancestor
   prefix (warning at parse time). Roots = codes with no ancestor in the file. Leaf = no
   children.
2. **`applyLeafEdits(tree, edits)`** — value edits overlay **leaf** cells only (the
   editor already restricts this; derive enforces it again). Comments attach to any
   account's cell.
3. **`computeRollups(tree)`** — post-order walk: every parent's monthly values = sum of
   children; result row = Σ roots(`4*`) − Σ roots(`5*`).
4. **`aggregate(values, frequency)`** — monthly base: mensual → 12 columns
   (`MONTHS_SHORT_ES` labels), trimestral → 4 sums (`T1`–`T4`), semestral → 2 (`S1`,
   `S2`), anual → 1 (`Total`). Annual base: the single stored column. The derived
   `Total` column (row sum) is appended for every frequency **except anual** (it would
   duplicate the single column).
5. **`toDatosGrid(...)`** — assembles the existing `DatosGrid`/`DatosRow` shape the
   table already renders: `title` = "Estado de Resultados", months = period labels for
   the active frequency, cells carry value + comment, `isResult` for Utilidad, and the
   utilidad badge = `{ label: "Utilidad" | "Pérdida" (by the sign of the result's
period total, formatted via formatCurrency), positive }`. An aggregated cell carries
   the comment marker when **any** underlying month cell has a comment (read-only
   indicator).
6. **`allowedFrequencies(base)`** — `mensual` ⇒ all four; `anual` ⇒ `["anual"]`.
   (Ready for `trimestral`/`semestral` bases when a real sample arrives.)

Frequency aggregation is plain summation — correct for an income statement; documented
here so nobody "fixes" it into averaging.

## Shared state — `components/profit-loss/pyg-data-provider.tsx`

`"use client"` React Context provider mounted in `app/(dashboard)/layout.tsx` wrapping
the shell (the layout itself stays a Server Component; the provider takes `children`).
It must wrap **both** the header and the content, because `ActiveClient` (header) and
`ModuleTabs` (content) live in different branches.

Exposes via `usePygData()`:

- `dataset: PygDataset | undefined` — `useLiveQuery` over `db.datasets`.
- `edits: CellEdit[]` — `useLiveQuery` over `db.edits` for the active dataset.
- `frequency: Frequency` + `setFrequency` — `useState`, reset to `baseFrequency` when a
  new dataset loads; setter ignores values outside `allowedFrequencies`.
- `uploadFile(file: File): Promise<void>` — parse → confirm replacement when edits
  exist → Dexie transaction. Sets `isUploading` / `uploadError`.
- `saveEdit(code, monthIndex, value, comment)` / edit lookup for the editor.
- `uploadError: string | null` + `clearUploadError()`.

No Zustand/Redux — Context + Dexie live queries cover this scale with zero new state
libraries. Grid derivation (`toDatosGrid`) lives in a `useMemo` in `DatosView`, not in
the provider, so only the Datos tab pays for it.

## UI wiring

- **`DatosToolbar`** — "Cargar Excel" (drop "/ ZIP") triggers a hidden
  `<input type="file" accept=".xls,.xlsx">`; while `isUploading` the button shows a
  spinner and disables. InfoTip copy drops ZIP and states: acepta el reporte mensual (con
  o sin línea de centro de costo) o anual del sistema contable; el consolidado por
  centros llega próximamente.
- **`DatosView`** — drops its local edits Map and mock-cost-center default; reads the
  provider, derives the grid via `useMemo`. An `uploadError` renders as a dismissible
  error banner (new small `components/profit-loss/` component, `border-negative`-toned)
  **above** the rest of the content — a failed upload must not hide an already-loaded
  table. Below it: no dataset ⇒ existing empty state; dataset ⇒ table. When
  `dataset.warnings` is non-empty, a dismissible amber note above the table: "El archivo
  tiene N descuadres de sumatoria; se muestran los valores recalculados."
- **Cost-center tabs** — `CostCenterTabs` renders only when the dataset has cost
  centers, which is **never** in this milestone (`FUTURE WORK` comment updated; mock
  list stays in fixtures for later). The `CostCenterFilter` dropdown keeps its empty
  state.
- **`PygToolbar`** — granularity moves from local state to `usePygData()`. Add
  **Anual** to `GRANULARITIES`. Options below `baseFrequency` (or all but Anual for an
  annual file) render disabled — extend `SegmentedControl` with optional per-option
  `disabled` support (`ui` primitive change, keep it generic).
- **Editor gating** — cells open the editor only when `frequency === "mensual"`
  (plus the existing leaf/value rules). A logical consequence: an **annual-base file
  has no editing or commenting at all** (it has no monthly view) — accepted, consistent
  with the decision. The README records this decision and the revisit path
  (aggregated-cell editing, e.g. prorating).
- **`DashboardHeader`** — already a client component; reads `usePygData()` and passes
  `{ name: companyName, period: periodLabel }` to the unchanged presentational
  `ActiveClient`. Sucursal metadata: when `costCenterName` exists, the period subline
  becomes "`periodLabel` · `costCenterName`".

## Error handling summary

| Case                               | Behavior                                                            |
| ---------------------------------- | ------------------------------------------------------------------- |
| Non-Excel / unreadable file        | `invalid-file` ⇒ error banner                                       |
| No account rows / header           | `no-accounts` / `no-header` ⇒ error banner                          |
| Consolidated cost-center file      | `consolidated-unsupported` ⇒ error banner (Spanish, "próximamente") |
| Annual-only file                   | Loads; frequency locked to Anual                                    |
| Sucursal monthly file              | Loads as monthly; center name in header subline                     |
| Parent/result values ≠ recomputed  | Dataset warning; computed values shown                              |
| Missing month columns              | Zero-filled + warning                                               |
| Replacing a dataset that has edits | `confirm()` in Spanish before wiping                                |

## Testing — Vitest (new)

- Add `vitest` (devDependency), scripts `"test": "vitest run"`,
  `"test:watch": "vitest"`, and a minimal `vitest.config.ts` (node environment — the
  layer under test is pure; alias `@/*` → repo root to match tsconfig).
- Tests colocated: `lib/profit-loss/parse.test.ts`, `derive.test.ts`.
- **Tests never read `.context`** (git-ignored client data). Fixtures are synthetic
  `Cell[][]` arrays committed in `lib/profit-loss/parse.fixtures.ts` (repo convention:
  `*.fixtures.ts`), **modeled on the `.context` samples' structure** — same skeleton,
  same quirks (shifted sucursal header, skipped hierarchy levels, negative discount
  rows, accent-less result row), but with invented company/account values. One fixture
  per format: monthly, sucursal, annual, consolidated, plus malformed variants. Build
  workbooks in-test via `XLSX.utils.aoa_to_sheet` where the ArrayBuffer path needs
  exercising.
- Core cases: header-row detection with/without the sucursal line · month-name mapping ·
  base-frequency classification · consolidated rejection · tree building with skipped
  levels and missing parents · parent rollups vs file values · utilidad = 4 − 5 ·
  aggregation per frequency · edit overlay (leaf-only) · allowedFrequencies.
- **CI:** add a fourth independent job running `pnpm test` in
  `.github/workflows/ci.yml`.

## Clean code requirements (explicit, per user)

- Layering: `parse.ts` / `derive.ts` are pure and framework-free; `db.ts` owns Dexie;
  React state lives only in the provider; components stay presentational.
- Small single-purpose functions; each parse step independently testable. No `any`;
  `strict` TypeScript throughout. Errors are typed (`PygParseError` with `code`).
- Reuse `lib/format.ts` + `lib/date.ts` — no local re-implementation of currency or
  month labels. New generic UI needs (SegmentedControl `disabled`) go into the
  primitive, not ad-hoc markup.
- Identifiers/slugs English, UI copy Spanish. Comments explain _why_ (e.g. why sums not
  averages, why computed parents win).
- Gates before done: `pnpm lint`, `pnpm test`, `pnpm build`.

## Performance

- SheetJS dynamically imported at upload time only; parsing a ~220-row sheet is
  milliseconds — no worker needed (YAGNI).
- Derivation chain (`tree → edits → rollups → aggregate → grid`) memoized in
  `DatosView` keyed on `(dataset, edits, frequency)`; the existing memoized
  rows/`content-visibility` patterns are untouched.
- Dexie live queries deliver granular updates (an edit re-renders via the same one-row
  path that exists today).

## Out of scope

ZIP upload, cost-center UI/detection-driven tabs and consolidated format support,
toolbar filters (grupo / ocultar ceros / expandir / nivel / período), Excel download
(with-data and template), Análisis/Gráficos tabs, styled confirm dialog,
quarterly/semestral **file** detection (frequency _viewing_ is in; only unseen source
formats are out), multi-dataset storage and original-vs-edited comparison (schema is
ready for it).

## Docs to update at the end

- **README.md** — document the Excel upload flow, supported/rejected formats, base
  frequency locking, and **the decision that editing/commenting is monthly-view-only**
  (with the possible future path of aggregated editing) so it can be revisited.
- **CLAUDE.md** — short additions: `lib/profit-loss/` is the pure parse/derive/Dexie
  layer feeding PyG; Vitest exists (`pnpm test`) for that layer only.
