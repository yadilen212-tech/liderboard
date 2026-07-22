# Dashboard shell — Sidebar + Header (LiderPlus)

Date: 2026-07-21
Status: Approved

## Goal

Implement the application shell for the LiderPlus financial dashboard: a
collapsible sidebar and a slim header, translated from the approved
`Dashboard LiderPlus.dc.html` design into a Next.js App Router codebase.

Desktop only. Speed and clean code are first-class constraints.

## Scope

In scope:

- Collapsible sidebar (logo, 4 module nav items, disabled "coming soon" item,
  active-client card, footer).
- Header with **only** breadcrumb + title + Export button.
- Routing skeleton for the 4 modules + placeholder pages so navigation works.
- Design tokens + IBM Plex fonts.

Out of scope: module content (tables, charts), real export logic, data layer,
auth, mobile/responsive behavior.

## Decisions (confirmed with user)

- **Close behavior:** collapse to an icon rail (icons stay visible, labels and
  client card hide). Desktop only — no off-canvas drawer.
- **Route slugs:** English (`/profit-loss`, `/salaries`, `/occupancy`, `/sales`).
  UI labels remain Spanish.
- **Export button:** simple stub `onClick` (per-module logic added later).
- **Toggle placement:** inside the sidebar (a chevron on its right edge). The
  header keeps _only_ breadcrumb + title + Export, so the toggle cannot live there.

## Architecture

```
app/
  layout.tsx                 root: <html>, IBM Plex fonts, metadata (Server)
  page.tsx                   redirect('/profit-loss') (Server)
  globals.css                Tailwind v4 + @theme tokens
  (dashboard)/
    layout.tsx               shell: <Sidebar/> + <Header/> + <main> (Server)
    profit-loss/page.tsx     placeholder (Server, static)
    salaries/page.tsx        placeholder (Server, static)
    occupancy/page.tsx       placeholder (Server, static)
    sales/page.tsx           placeholder (Server, static)
components/dashboard/
    sidebar.tsx              Client: collapse state, active link, toggle
    header.tsx               Client: breadcrumb + title + Export stub
    module-placeholder.tsx   Server: shared empty state
lib/
    modules.ts               single source of truth (slug/label/title/icon)
    cn.ts                    tiny className joiner (no external dep)
```

## Rendering strategy (speed)

- Module pages are static Server Components → 0 client JS for content.
- Only Sidebar + Header ship client JS (nav, toggle, `usePathname`).
- `(dashboard)/layout.tsx` persists across navigation → shell never re-mounts;
  the sidebar's collapse state survives module switches without localStorage.
- `next/font` self-hosts IBM Plex (no blocking CDN, no CLS).
- `lucide-react` is tree-shaken (only used icons bundled), replacing the design's
  CDN `<script>`.
- `<Link>` prefetch → instant module switching. Collapse is a CSS `width`
  transition.

## Components

### `lib/modules.ts`

Ordered `MODULES` array `{ slug, label, title, icon }`, a `COMING_SOON` entry,
`DEFAULT_MODULE`, and `findModuleBySlug()`. Consumed by both Sidebar (nav) and
Header (title/breadcrumb) — no duplication.

### Sidebar (client)

- Width `264px` ↔ `72px` via `useState('collapsed')` + CSS transition.
- Floating chevron toggle on the right border edge.
- Active link derived from `usePathname()`; navy left-bar + `brand-soft` bg.
- Collapsed: labels, badges, client card, brand text hide; icons center; nav
  items get `title` tooltips.

### Header (client)

- Breadcrumb `Módulos › {title}` + `<h1>{title}</h1>` + Export button (navy,
  download icon, stub onClick). No search, no user profile.

### Placeholder pages (server)

Shared `ModulePlaceholder` empty state keyed by slug.

## Design tokens (`@theme`)

`brand #1E3A5F` · `brand-soft rgba(30,58,95,.08)` · `canvas #F4F6F8` ·
`surface #FFF` · `border #E5E9EE` · `ink #1E293B` · `muted #64748B` ·
`faint #94A3B8`. Styling via Tailwind utilities (no inline styles).

## Verification

`pnpm fmt` · `pnpm lint` · `pnpm build` must pass.
