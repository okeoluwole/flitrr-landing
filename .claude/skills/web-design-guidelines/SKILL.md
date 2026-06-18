---
name: web-design-guidelines
description: >-
  flitrr-landing's design system and UI conventions — the locked amber/ink/paper
  palette and CSS custom-property tokens, the marketing (ink) vs product
  (Instrument) surface split, the "amber means one thing" rule, type scale,
  spacing, motion tokens, CSS Modules conventions, and AA contrast discipline.
  Use when building, editing, reviewing, or styling any UI in this repo (pages,
  components, CSS Modules, globals.css) so new work matches the system.
---

# flitrr-landing — Design System & UI Guidelines

This is the project's house style. The single source of truth is
**`app/globals.css`** (every token) and **`LANDING_ASSET_MAP.md`** (Part C
typography, Part D the locked palette). Build to the tokens; don't reinvent.

> Generic web-design fundamentals (spacing scales, WCAG, line length, etc.)
> still apply — this file records how *this codebase* expresses them. Where they
> conflict, the repo wins.

## The non-negotiables

1. **Two surfaces, never mixed.**
   - **Marketing pages stand on ink** — the dark ground (`--color-ink-950`
     page, `--color-ink-900` raised band, `--color-ink-800` card). Text uses
     `--color-on-ink-primary/secondary/faint`.
   - **The product app (PULSE) is "Instrument":** a dark **console** chrome (the
     ink ramp, reused via `--app-console*`) wrapped around a light, cool **paper**
     canvas (`--app-paper`, `--app-surface`) with `--app-ink*` text.
   - Marketing ink tokens and product `--app-*` tokens are *separate systems*.
     Don't pull `--app-*` into marketing pages, or marketing ink tokens into the
     app. Light brand pages (legal, etc.) use the light semantic tokens
     (`--color-text-*`, `--color-surface-*`).

2. **Amber means one thing, everywhere: the thing that matters.**
   Signal, criticality, and the primary CTA — nothing else. A reserved accent,
   never decoration.
   - Amber as a **fill or line:** `--color-signal-amber` (`--app-signal`).
   - Amber as **text:** never the raw amber (it fails contrast). Use its
     text-safe sibling **ochre** — `--color-ochre` / `--app-signal-ink`.

3. **The palette is locked.** Compose from existing tokens; don't introduce new
   hex values inline. A genuinely new shade is added to `globals.css` as a token
   first (the system has been actively de-hardcoded — keep it that way).

4. **Tokens are the source of truth.** No hardcoded hex or magic px in component
   CSS — reference the custom properties. Colour, spacing, radius, shadow,
   easing, and duration all have tokens.

5. **AA contrast is enforced by token choice.** Body text on its surface ≥4.5:1;
   large text / UI boundaries ≥3:1.
   - Placeholders use `--app-ink-secondary` (NOT `--app-ink-muted`) to hold AA.
   - `--app-ink-muted` / `--color-text-muted` / `--color-on-ink-faint` are for
     **non-essential metadata, large text, or labels only** — never body copy.

## Tokens at a glance
Full list with values: **[references/tokens.md](references/tokens.md)**. The
groups you'll reach for:
- **Brand / marketing:** `--color-background-amber`, `--color-foreground-cream`,
  `--color-accent-1-deep-blue`… plus the **ink ramp** `--color-ink-950…700`,
  `--color-on-ink-primary/secondary/faint`, `--color-ink-hairline(-strong)`.
- **Product (Instrument):** `--app-console*`, `--app-paper/surface/surface-sunken`,
  `--app-ink/-secondary/-muted`, `--app-hairline/border/border-strong`,
  `--app-signal*`, `--app-focus`, `--app-danger/success/warning`.
- **Elevation:** marketing `--shadow-card`, `--shadow-card-hover`, `--shadow-ink`;
  product `--app-elev-1`, `--app-elev-2`, `--app-elev-console`.
- **Radii (product):** `--app-radius-sm` 8 · `--app-radius` 10 · `--app-radius-lg` 14.
- **Layout:** `--container` 1200px · `--container-wide` 1360px (photographic
  bands) · `--section-py` 5rem. Use the global `.container` helper.

## Typography
- **Fonts:** headings = **Bricolage Grotesque** (`--font-heading`), body =
  **Inter** (`--font-body`). Don't add families.
- **Headings:** weight 800, `line-height: 1.1`, `letter-spacing: -0.015em`.
  - h1 `clamp(2.5rem, 6vw, 4.5rem)` (lh 1.05, ls -0.02em) · h2 `2.75rem` ·
    h3 `1.375rem`.
- **Body:** 1rem, `line-height: 1.6`.
- **Product type scale** (fixed rem, ~1.2 ratio): `--app-text-xs` 0.75 →
  `--app-text-xl` 1.75rem.
- **Numbers** (money, dates, stage numerals): add the **`.tnum`** utility for
  tabular figures (the "instrument voice").

## Spacing & layout
- Section rhythm via `--section-py` (5rem).
- Page width via the global `.container` (max `--container`, `padding-inline`
  1.5rem → 2.5rem at ≥768px). Photographic bands may use `--container-wide`.
- Mobile-first; the breakpoint in play is **768px**. Add others only where the
  design actually breaks.

## Motion
Details in **[references/conventions.md](references/conventions.md)**.
- CSS-first, off the main thread, always **motivated** and short.
- Use the tokens: easing `--ease-out`, `--ease-out-soft`, `--ease-in-out`,
  `--ease-drawer`; duration `--dur-press` 130 / `--dur-fast` 180 / `--dur-base`
  240 / `--dur-slow` 440ms (keep UI moves < ~300ms).
- Reuse shared keyframes/utilities: `flitrr-rise`, `flitrr-rise-sm`,
  `flitrr-pop` (popovers — starts at `scale(0.96)`, never `scale(0)`),
  `flitrr-pulse` (skeletons); `.riseIn` / `.riseInSm` for mount entrances,
  `[data-reveal]` for scroll reveals, `--rise-delay` to stagger.
- **All motion lives behind `@media (prefers-reduced-motion: no-preference)`** so
  reduced-motion (and the no-JS/no-CSS fallback) lands on the natural,
  fully-visible resting state. Keep new motion in that gate; animate
  transform/opacity only. JS/canvas motion must check `matchMedia` and bail.

## Components — house patterns
- **Buttons:** primary (`--color-button-primary-*`), ghost
  (`--color-button-ghost-*`), amber (`--color-button-amber-*`, the reserved
  CTA). Native `<button>`s already get press feedback (`scale(0.97)` on
  `:active`); `<a>`-buttons carry their own `:active` in their module.
- **Status pills (PULSE):** `--color-pill-in-build-*`, `--color-pill-designed-*`,
  `--color-pill-planned-*`.
- **Forms:** `--color-input-*`; focus ring uses `--color-input-focus` /
  `--app-focus` (`--app-focus-on-console` on dark chrome). Visible labels;
  errors via `--color-error` / `--app-danger` — text + colour, never colour
  alone.
- **Cards / critical:** one shadow recipe per surface (`--shadow-card` /
  `--app-elev-*`). Critical state = a full border + faint wash
  (`--color-critical-card-*` / `--app-critical-*`), not a side-stripe.
- **Signature motif:** the pulse-line rail (`--app-rail-*`) — done segments go
  amber.

## File & code conventions
See **[references/conventions.md](references/conventions.md)** for the full set.
- **Styling = CSS Modules** (`*.module.css`) per page/component; **all design
  tokens live in `app/globals.css`** under `:root`. No Tailwind, no inline style
  objects for themeable values.
- Keep the global reset/base (`box-sizing: border-box`; `a { color: inherit }`;
  `img, svg { display:block; max-width:100% }`).
- Photos on ink take the dusk **grade** (`--grade-top/bottom/amber`) so mixed
  sources read as one shoot.
- Print: the PULSE brief has dedicated `@media print` rules — keep app chrome out
  of print and the brief in normal flow.

## Before you ship
Run **[references/checklist.md](references/checklist.md)**. Minimum bar: right
surface tokens (ink vs `--app-*`), amber only for signal (ochre for amber text),
no hardcoded hex/px, AA contrast, motion inside the reduced-motion gate,
responsive at 768px, `.container` for width.
