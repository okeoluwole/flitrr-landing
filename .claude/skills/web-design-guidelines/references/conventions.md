# flitrr-landing: code & UI conventions

## Stack
Next.js 14 (App Router) · React 18 · CSS Modules + `app/globals.css` ·
Three.js (`HeroMark`, `RubiksCube`, ...) · Supabase (auth/data). **No
Tailwind.**

## Styling
- One `*.module.css` per page/component (e.g. `app/home.module.css`,
  `app/pulse/app/risk/RiskRegister.module.css`). Component styles stay
  local; **all design tokens live in `app/globals.css`** under `:root`.
- Reference tokens; never hardcode hex/px for themeable values. If you need
  a new value, add a token in `globals.css` first, then use it.
- The global reset/base is already set: `box-sizing: border-box`, zeroed
  margins/padding, `a { color: inherit; text-decoration: none }`,
  `button { cursor: pointer; font-family: inherit }`,
  `img, svg { display: block; max-width: 100% }`.
- Page width via the global `.container` helper (marketing).

## Fonts (wired in `app/layout.js`)
- **Marketing:** **Bricolage Grotesque** (`--font-heading`, the global
  heading default) · **Inter** (`--font-body`, the global body default) ·
  **Archivo** (`--font-archivo`, the "Considered" marketing surfaces: home,
  /pulse, /framework, the auth pages; consumed only inside those modules).
  All three via `next/font/google`.
- **Product (Instrument):** **Geist** (`--app-font-sans`) and **Geist Mono**
  (`--app-font-mono`), bundled locally via the `geist` npm package (Next
  14.2's Google font data predates Geist). Their `.variable` classes expose
  `--font-geist-sans` / `--font-geist-mono`, consumed only through the
  `--app-font-*` tokens, so marketing type is untouched. The display face
  is dropped in-product.
- **Document:** the Brief sets in `--doc-font-serif` (Georgia stack,
  zero-install), with mono for its metadata furniture.
- Use the variables; don't import more families.

## Surfaces: pick the right system
- **Marketing / landing pages:** ink tokens (`--color-ink-*`,
  `--color-on-ink-*`), signal amber on ink.
- **Authenticated PULSE app:** Instrument `--app-*` tokens. Fully dark:
  graphite ground, hairline-seated panels, console chrome. `--app-paper` is
  the legacy name for the dark ground (#0E1216); only `DashboardShell`
  references it, so don't spread the name. Panels sit on `--app-surface`.
- **The produced Brief** (its exports and MemberBriefView too): `--doc-*`
  warm paper only, from Phase 4. Darkening the app never darkens the Brief.
- **Light brand pages** (legal, privacy, terms): light semantic tokens
  (`--color-text-*`, `--color-surface-*`).

Never mix the systems: `--app-*` stays out of marketing pages, marketing
ink stays out of the app, `--doc-*` stays off instrument surfaces.

## Motion
- Put every animation behind `@media (prefers-reduced-motion: no-preference)`.
  The resting state (reduced-motion / no-JS / no-CSS) must be fully visible;
  never ship content that depends on JS to become visible.
- Use the motion tokens (easing + duration) and the shared
  keyframes/utilities rather than ad-hoc ones. Animate transform/opacity;
  keep UI moves under ~300ms.
- **In-product: 150 to 250ms, on state change only** (step advance, save,
  reveal, menu). No page-load choreography in the app; scroll reveals
  (`[data-reveal]`) are a marketing pattern.
- JS-driven motion (Three.js, canvas, IntersectionObserver) must also check
  `window.matchMedia('(prefers-reduced-motion: reduce)')` and bail; see
  `HeroMark.js`, `RubiksCube.js`, `PulseGlance.js`, `LifecycleJourney.js`,
  `PulseWorkspaceDemo.js`.

## Numbers
Apply `.tnum` to money, dates, and stage numerals wherever sans sets them.
In-product the numeric voice is Geist Mono (`--app-font-mono`): money,
dates, stage numerals, criticality scores, reference ids, micro-labels.

## Print (PDF export of the PULSE brief)
Global `@media print` sets A4 / zero page margin / white background;
components hide the app chrome and flush the brief in normal document flow
so per-element page-breaks work. The console is dropped and the sheet
prints as a document (`--doc-*` paper, never the dark instrument). Preserve
this behaviour when touching app layout.

## Source of truth
- **Tokens & base:** `app/globals.css`.
- **Product surface & locked decisions:** the workspace `DESIGN.md` (one
  level above this repo; the Instrument strategy, approved 2026-07-10).
- **Palette (Part D) & typography (Part C):** `LANDING_ASSET_MAP.md`.
- **Broader plan / context:** `LANDING_REWRITE_PLAN.md`.
