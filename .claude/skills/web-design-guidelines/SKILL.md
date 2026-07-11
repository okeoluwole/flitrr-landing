---
name: web-design-guidelines
description: >-
  flitrr-landing's design system and UI conventions: the locked amber/ink
  marketing palette, the fully dark "Instrument" product surface (--app-*
  tokens), the --doc-* paper group reserved for the produced Brief, the
  "amber means one thing" rule (criticality only, in-product), Geist + Geist
  Mono product type vs the marketing faces, spacing, motion tokens, CSS
  Modules conventions, and AA contrast discipline. Use when building,
  editing, reviewing, or styling any UI in this repo (pages, components,
  CSS Modules, globals.css) so new work matches the system.
---

# flitrr-landing: Design System & UI Guidelines

This is the project's house style. The sources of truth are
**`app/globals.css`** (every token), the workspace **`DESIGN.md`** (one level
above this repo: the Instrument product surface and its locked decisions,
approved 2026-07-10), and **`LANDING_ASSET_MAP.md`** (Part C typography,
Part D the locked palette). Build to the tokens; don't reinvent.

> Generic web-design fundamentals (spacing scales, WCAG, line length, etc.)
> still apply. This file records how *this codebase* expresses them. Where
> they conflict, the repo wins.

## The non-negotiables

1. **Three surfaces, never mixed.**
   - **Marketing pages stand on ink**: the dark ground (`--color-ink-950`
     page, `--color-ink-900` raised band, `--color-ink-800` card). Text uses
     `--color-on-ink-primary/secondary/faint`.
   - **The product app (PULSE) is "Instrument", and it is fully dark:** a
     cool graphite ground (`--app-paper` **#0E1216**, a legacy token NAME
     pending rename; the value is dark) with hairline-seated panels
     (`--app-surface` #161C22), console chrome (`--app-console*`), and
     `--app-ink*` text. Deliberately cooler and flatter than the marketing
     ink, so the two blacks read as different blacks. Density is a virtue:
     panels seat on hairlines, they don't float as gapped cards.
   - **The produced document stands on `--doc-*` warm paper:** the Brief,
     its exports, MemberBriefView (consumed from Phase 4). Dark tool frames
     light output; darkening the app never darkens the Brief. Serif lives
     here only.
   - These are *separate systems*. Don't pull `--app-*` into marketing
     pages, marketing ink into the app, or `--doc-*` onto instrument
     surfaces. Light brand pages (legal, etc.) use the light semantic tokens
     (`--color-text-*`, `--color-surface-*`).

2. **Amber means one thing.**
   - **In the product: criticality, only.** Not status, not progress, not
     done states, not decoration, not chrome. The single amber chrome
     element is the pulse-line brand mark in the shell top bar (PULSE's
     signature; the glyph is PULSE's mark, never general Flitrr chrome).
     Shipped proof: the workspace spends amber only on open critical
     actions; the gate only on the over-constraint caution.
   - **On marketing: signal, criticality, and the primary CTA.** Nothing
     else. A reserved accent, never decoration.
   - Amber as a **fill or line:** `--color-signal-amber` / `--app-signal`.
   - Amber as **text:** never raw amber on light surfaces (it fails
     contrast). On the dark instrument use `--app-signal-ink` (#ECC172); on
     light and paper surfaces use ochre (`--color-ochre` / `--doc-ochre`).
   - **The product's primary action is NOT amber.** It is structural white
     (`--app-primary`), and the product focus ring is white too
     (`--app-focus`), so focus is never confusable with the criticality
     read.

3. **The palette is locked.** Compose from existing tokens; don't introduce
   new hex values inline. A genuinely new shade is added to `globals.css` as
   a token first (the system has been actively de-hardcoded; keep it that
   way).

4. **Tokens are the source of truth.** No hardcoded hex or magic px in
   component CSS; reference the custom properties. Colour, spacing, radius,
   shadow, easing, and duration all have tokens.

5. **AA contrast is enforced by token choice.** Body text on its surface
   at 4.5:1 or better; large text and UI boundaries at 3:1 or better.
   - On the dark instrument, all three inks clear AA on every app surface:
     `--app-ink` (body), `--app-ink-secondary` (supporting),
     `--app-ink-muted` (non-essential metadata; about 5.3:1 on
     `--app-surface-sunken`). **Placeholders on the dark surfaces use
     `--app-ink-muted`**, as the shipped risk register and action log do, so
     an empty field reads quieter than entered text. Body copy still never
     sets in muted.
   - On marketing ink, `--color-on-ink-faint` is for metadata, large text,
     or labels only; on light pages the same goes for `--color-text-muted`.

## Tokens at a glance
Full list with values: **[references/tokens.md](references/tokens.md)**. The
groups you'll reach for:
- **Brand / marketing:** `--color-background-amber`, `--color-foreground-cream`,
  `--color-accent-1-deep-blue`, plus the **ink ramp** `--color-ink-950` to
  `-700`, `--color-on-ink-primary/secondary/faint`,
  `--color-ink-hairline(-strong)`.
- **Product (Instrument, dark):** chrome `--app-console*`; ground
  `--app-paper` (dark; legacy name) with `--app-surface/-raised/-sunken`;
  ink `--app-ink/-secondary/-muted`; lines `--app-hairline`, `--app-border`,
  `--app-border-strong`, `--app-hover`; signal `--app-signal*` and
  `--app-critical-*`; the white `--app-primary/-ink/-hover` and
  `--app-focus`; states `--app-danger(-wash/-border)/success/warning`;
  fonts `--app-font-sans/-mono`.
- **Document:** `--doc-paper(-2)`, the `--doc-ink` ramp, `--doc-line`,
  `--doc-navy/ochre/signal`, `--doc-font-serif/-mono`, `--doc-radius`,
  `--doc-shadow`.
- **Elevation:** marketing `--shadow-card`, `--shadow-card-hover`,
  `--shadow-ink`; product `--app-elev-1`, `--app-elev-2` (shadow plus a
  faint inset top light), `--app-elev-console`.
- **Radii (product):** `--app-radius-sm` 8 · `--app-radius` 10 ·
  `--app-radius-lg` 14.
- **Layout:** `--container` 1200px · `--container-wide` 1360px (photographic
  bands) · `--section-py` 5rem. Use the global `.container` helper.

## Typography
- **Marketing:** global headings = **Bricolage Grotesque** (`--font-heading`,
  weight 800, `line-height: 1.1`, `letter-spacing: -0.015em`), body =
  **Inter** (`--font-body`, 1rem, `line-height: 1.6`). The "Considered"
  marketing pages (home, /pulse, /framework, the auth pages) set **Archivo**
  through `--font-archivo` in their own modules. Marketing faces never
  appear in-product.
  - h1 `clamp(2.5rem, 6vw, 4.5rem)` (lh 1.05, ls -0.02em) · h2 `2.75rem` ·
    h3 `1.375rem`.
- **Product (Instrument): Geist + Geist Mono**, via `--app-font-sans` /
  `--app-font-mono` (the `geist` npm package, wired in `app/layout.js`).
  Geist carries the voice: headings 600, labels 500, body 400. Geist Mono
  carries the numeric instrument voice: money, dates, stage numerals,
  criticality scores, reference ids, and the micro-labels (chips, eyebrows,
  pane captions). Sentence case throughout; uppercase only on mono
  micro-labels. **No display faces in-product.**
- **Product type scale** (fixed rem, about 1.2 ratio): `--app-text-xs` 0.75
  to `--app-text-xl` 1.75rem. Never the marketing clamp scale.
- **Document:** the Brief sets in `--doc-font-serif` (Georgia stack) with
  mono for its metadata furniture. Serif never appears on instrument
  surfaces.
- **Numbers:** add the **`.tnum`** utility for tabular figures wherever sans
  sets numbers; in-product, prefer mono for the numeric voice.
- Don't add families beyond this loaded set.

## Spacing & layout
- Section rhythm via `--section-py` (5rem) on marketing pages.
- Page width via the global `.container` (max `--container`,
  `padding-inline` 1.5rem, 2.5rem at 768px and up). Photographic bands may
  use `--container-wide`.
- Mobile-first; the breakpoint in play is **768px**. Add others only where
  the design actually breaks. Phone-first product surfaces keep 44px touch
  targets.

## Motion
Details in **[references/conventions.md](references/conventions.md)**.
- CSS-first, off the main thread, always **motivated** and short.
- Use the tokens: easing `--ease-out`, `--ease-out-soft`, `--ease-in-out`,
  `--ease-drawer`; duration `--dur-press` 130 / `--dur-fast` 180 /
  `--dur-base` 240 / `--dur-slow` 440ms (keep UI moves under ~300ms).
- **In-product (the product register): 150 to 250ms, on state change only**
  (step advance, save, reveal, menu). No page-load choreography in the app.
- Reuse shared keyframes/utilities: `flitrr-rise`, `flitrr-rise-sm`,
  `flitrr-pop` (popovers: starts at `scale(0.96)`, never `scale(0)`),
  `flitrr-pulse` (skeletons); `.riseIn` / `.riseInSm` for mount entrances,
  `[data-reveal]` for scroll reveals (marketing), `--rise-delay` to stagger.
- **All motion lives behind `@media (prefers-reduced-motion: no-preference)`**
  so reduced-motion (and the no-JS/no-CSS fallback) lands on the natural,
  fully-visible resting state. Keep new motion in that gate; animate
  transform/opacity only. JS/canvas motion must check `matchMedia` and bail.

## Components: house patterns
- **Buttons (marketing):** primary (`--color-button-primary-*`), ghost
  (`--color-button-ghost-*`), amber (`--color-button-amber-*`, the reserved
  CTA). Native `<button>`s already get press feedback (`scale(0.97)` on
  `:active`); `<a>`-buttons carry their own `:active` in their module.
- **Buttons (product):** primary is structural white (`--app-primary` fill,
  `--app-primary-ink` text, `--app-primary-hover`), never honey; ghost is
  transparent with `--app-border`; danger is an `--app-danger` fill with
  `--app-primary-ink` text. Every control ships default, hover, focus,
  active, disabled.
- **Register panel (the product work surface):** one panel (`--app-surface`,
  `--app-border`, `--app-radius-lg`, `--app-elev-1`) with hairline-divided
  rows and `--app-hover` row hover. Not floating cards with gaps.
- **Chips (product):** mono, 11px, uppercase, pill-shaped, monochrome by
  intensity (brightest = most alive). Status is not criticality: no amber.
- **Forms (product):** label 13px/500 in ink; control on `--app-surface`
  with a 1px `--app-border` and `--app-radius-sm`; focus is an `--app-focus`
  (white) border plus wash; read-only sits on `--app-surface-sunken` with no
  focus ring; placeholders in `--app-ink-muted`. Errors via `--app-danger`
  (dark-tuned): text plus colour, never colour alone. Marketing forms use
  `--color-input-*` with the `--color-input-focus` ring.
- **Criticality:** critical items take `--app-critical-bg` plus a full
  `--app-critical-border`, never a side-stripe. The severity read is
  monochrome apart from critical: no RAG traffic lights in the register
  (the Programme module's schedule RAG is a separate axis).
- **Stage rail:** monochrome (`--app-rail-*`): done is a grey fill, current
  is a white ring. Amber returns to the rail only if a stage itself is at
  risk. This overrides the old done-goes-amber canon (2026-07-10).
- **Shell:** `DashboardShell` is the shared chrome: a dense 56px top bar on
  `--app-console`, seated with a hairline; the amber pulse-line mark plus a
  monochrome wordmark.
- **Product register bans:** no glassmorphism, no gradient text, no
  side-stripe borders, no display fonts in-product, no radius above 16px on
  cards. Operability stays governance-shaped: escalation and drill-in,
  never owner or due-date on the register or the Action Log.

## File & code conventions
See **[references/conventions.md](references/conventions.md)** for the full
set.
- **Styling = CSS Modules** (`*.module.css`) per page/component; **all
  design tokens live in `app/globals.css`** under `:root`. No Tailwind, no
  inline style objects for themeable values.
- Keep the global reset/base (`box-sizing: border-box`;
  `a { color: inherit }`; `img, svg { display:block; max-width:100% }`).
- Photos on ink take the dusk **grade** (`--grade-top/bottom/amber`) so
  mixed sources read as one shoot.
- Print: the PULSE brief has dedicated `@media print` rules. The console is
  dropped and the sheet prints on `--doc-*` paper; keep app chrome out of
  print and the brief in normal flow.

## Before you ship
Run **[references/checklist.md](references/checklist.md)**. Minimum bar:
right surface tokens (ink vs `--app-*` vs `--doc-*`), amber spent on
criticality only in-product (`--app-signal-ink` or ochre for amber text),
white primary and white focus in the app, no hardcoded hex/px, AA contrast,
motion inside the reduced-motion gate, responsive at 768px, `.container`
for width.
