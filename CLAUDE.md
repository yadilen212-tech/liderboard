# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`liderboard` — the **LiderPlus** financial dashboard, a web app for an accounting
firm. UI copy is in **Spanish**; code (identifiers, route slugs) is in **English**.
Desktop only — no responsive/mobile layer.

## Commands

Package manager is **pnpm** (pinned via `packageManager`). Node LTS.

| Task                                | Command                               |
| ----------------------------------- | ------------------------------------- |
| Dev server (Turbopack, :3000)       | `pnpm dev`                            |
| Production build (also type-checks) | `pnpm build`                          |
| Serve production build              | `pnpm start`                          |
| Lint                                | `pnpm lint` (or `pnpm exec oxlint .`) |
| Lint + autofix                      | `pnpm lint:fix`                       |
| Format                              | `pnpm fmt`                            |
| Format check (CI gate)              | `pnpm fmt:check`                      |

There is **no test runner configured** — do not assume Jest/Vitest exist.

CI (`.github/workflows/ci.yml`) runs three independent jobs on PRs and pushes to
`main`: `pnpm lint`, `pnpm fmt:check`, `pnpm build`. A husky pre-commit hook runs
`lint-staged` (oxlint --fix + oxfmt on staged files).

## Toolchain gotchas

- **Linting/formatting is oxc, not ESLint/Prettier.** `pnpm lint` runs `oxlint`;
  `pnpm fmt` runs `oxfmt`. Running `eslint`/`prettier` directly will fail — they
  are not installed. oxlint config is `.oxlintrc.json` (only the `correctness`
  category is set to error).
- oxlint enforces `next/no-assign-module-variable`: never name a local `module`
  (use `mod`).
- **Tailwind CSS v4, CSS-first.** There is no `tailwind.config.js`. Theme lives in
  `app/globals.css` via `@import "tailwindcss"` + an `@theme { … }` block.
- TypeScript is `strict`; import alias `@/*` maps to the repo root (e.g.
  `@/lib/modules`).

## Architecture

Next.js **App Router**. Server Components by default — keep the client boundary
small; only files that need `usePathname`/local state are marked `"use client"`.

**Shell + routing.** `app/page.tsx` redirects `/` to the default module.
`app/(dashboard)/` is a route group whose `layout.tsx` renders the persistent
shell (`<DashboardSidebar/>` + `<DashboardHeader/>` + `<main>`). Because App Router
layouts persist across navigation, the sidebar's collapse state (local `useState`)
survives switching modules without any global store or localStorage. Each module is
a static page at `app/(dashboard)/<slug>/page.tsx`.

**Module registry is the single source of truth.** `lib/modules.ts` exports the
ordered `MODULES` array (`{ slug, label, title, icon, tabs }`) plus `DEFAULT_MODULE`
and `findModuleBySlug()`. Both the sidebar nav and the header breadcrumb/title derive
from it — there is no duplicated module list. **To add a module:** add an entry to
`MODULES` and create the matching `app/(dashboard)/<slug>/page.tsx`. Route slugs are
English; the Spanish name goes in `label`/`title`.

**Components.** Reusable primitives live in `components/ui/` — prefer them over ad-hoc
markup. Module-specific compositions live in `components/<module>/` (currently
`components/profit-loss/`: the PyG filter toolbar + "Comparar" box, visual-only).
`ModuleTabs` renders a module's toolbar between the tabs and the content panel when one
exists (only PyG today); `ActiveClient` shows the client name in the header for PyG.
Filter lists sourced from an uploaded Excel (cuentas, centros de costo) render empty
states until data loads.

**Design tokens.** Colors and fonts are defined once in `app/globals.css`'s
`@theme` block (`brand`, `brand-soft`, `canvas`, `surface`, `border`, `ink`,
`muted`, `faint`) and consumed as Tailwind utilities (`bg-brand`, `text-muted`, …).
Prefer these tokens over hardcoded hex/inline styles. Fonts are IBM Plex Sans/Mono
loaded via `next/font` in the root layout; icons come from `lucide-react`.

## Design source

The UI is translated from a Claude Design file, "Dashboard LiderPlus.dc.html"
(claude.ai/design project `1fed77ae-29ff-439e-a0d1-f01e3b3abe5e`). Approved specs
live under `docs/superpowers/specs/`.
