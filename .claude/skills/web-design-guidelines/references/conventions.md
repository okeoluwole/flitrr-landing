# flitrr-landing — code & UI conventions

## Stack
Next.js 14 (App Router) · React 18 · CSS Modules + `app/globals.css` · Three.js
(`HeroMark`, `RubiksCube`, …) · Supabase (auth/data). **No Tailwind.**

## Styling
- One `*.module.css` per page/component (e.g. `app/page.module.css`,
  `app/components/PulseGlance.module.css`). Component styles stay local; **all
  design tokens live in `app/globals.css`** under `:root`.
- Reference tokens — never hardcode hex/px for themeable values. If you need a
  new value, add a token in `globals.css` first, then use it.
- The global reset/base is already set: `box-sizing: border-box`, zeroed
  margins/padding, `a { color: inherit; text-decoration: none }`,
  `button { cursor: pointer; font-family: inherit }`,
  `img, svg { display: block; max-width: 100% }`.
- Page width via the global `.container` helper.

## Fonts (`next/font/google`, in `app/layout.js`)
**Bricolage Grotesque** → `--font-heading`; **Inter** → `--font-body`. Use the
variables; don't import more families.

## Surfaces — pick the right system
- **Marketing / landing pages →** ink tokens (`--color-ink-*`,
  `--color-on-ink-*`), signal amber on ink.
- **Authenticated PULSE app →** Instrument `--app-*` tokens (console chrome +
  paper canvas).
- **Light brand pages** (legal, privacy, terms) → light semantic tokens
  (`--color-text-*`, `--color-surface-*`).

Never mix `--app-*` with marketing ink, or vice versa.

## Motion
- Put every animation behind `@media (prefers-reduced-motion: no-preference)`.
  The resting state (reduced-motion / no-JS / no-CSS) must be fully visible —
  never ship content that depends on JS to become visible.
- Use the motion tokens (easing + duration) and the shared keyframes/utilities
  rather than ad-hoc ones. Animate transform/opacity; keep UI moves < ~300ms.
- JS-driven motion (Three.js, canvas, IntersectionObserver) must also check
  `window.matchMedia('(prefers-reduced-motion: reduce)')` and bail — see
  `HeroMark.js`, `RubiksCube.js`, `PulseGlance.js`, `LifecycleJourney.js`,
  `PulseWorkspaceDemo.js`.

## Numbers
Apply `.tnum` to money, dates, and stage numerals for tabular figures.

## Print (PDF export of the PULSE brief)
Global `@media print` sets A4 / zero page margin / white background; components
hide the app chrome and flush the brief in normal document flow so per-element
page-breaks work. Preserve this behaviour when touching app layout.

## Source of truth
- **Tokens & base:** `app/globals.css`.
- **Palette (Part D) & typography (Part C):** `LANDING_ASSET_MAP.md`.
- **Broader plan / context:** `LANDING_REWRITE_PLAN.md`.
