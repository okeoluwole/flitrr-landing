# flitrr-landing: token reference

Source of truth: **`app/globals.css`**. Values below mirror it; if they ever
drift, the CSS wins. Never hardcode these values; reference the custom
property.

## Brand palette (locked, `LANDING_ASSET_MAP.md` Part D)
| Token | Value |
|---|---|
| `--color-background-amber` | #F4C031 |
| `--color-foreground-cream` | #F2F0F4 |
| `--color-accent-1-deep-blue` | #376183 |
| `--color-accent-2-grey-blue` | #7793A8 |
| `--color-accent-3-light-grey-blue` | #B5BCCA |

## Semantic: light / marketing base
- **Text:** `--color-text-primary` (deep-blue) · `--color-text-secondary`
  (grey-blue) · `--color-text-muted` (light-grey-blue, *non-essential only*) ·
  `--color-text-inverse` (cream).
- **Surfaces:** `--color-surface-hero` (amber) · `--color-surface-section`
  (cream) · `--color-surface-cta-band` (deep-blue) · `--color-surface-card`
  (cream).
- **Borders:** `--color-border` · `--color-border-strong` ·
  `--color-divider-on-dark`.

## Ink theme: marketing ground
| Token | Value | Use |
|---|---|---|
| `--color-ink-950` | #0B141E | page ground |
| `--color-ink-900` | #101C29 | raised band |
| `--color-ink-800` | #142435 | card on ink |
| `--color-ink-700` | #1D3349 | elevated edge / hover |
| `--color-on-ink-primary` | #EDF1F5 | body text on ink |
| `--color-on-ink-secondary` | #A9BCCC | supporting text |
| `--color-on-ink-faint` | #6E8499 | metadata; large/label use only |
| `--color-ink-hairline` | rgba(237,241,245,.12) | hairline |
| `--color-ink-hairline-strong` | rgba(237,241,245,.22) | stronger hairline |

Signal on ink: `--color-signal-amber` (=amber) · `--color-signal-amber-deep`
#D9A61F · `--color-signal-amber-wash` rgba(244,192,49,.12).

Photo grade (dusk): `--grade-top` rgba(11,20,30,.10) · `--grade-bottom`
rgba(11,20,30,.62) · `--grade-amber` rgba(244,192,49,.07).

## Amber-as-text / criticality (light surfaces)
- `--color-ochre` **#8A6A16**: amber's text-safe sibling on light. One
  meaning everywhere: the thing that matters. Use wherever amber would be
  text on a light surface (on the dark instrument use `--app-signal-ink`).
- `--color-critical-card-border` rgba(212,165,39,.55) ·
  `--color-critical-card-bg` #FFFCF4. *Legacy of the light app; currently
  unreferenced by any module. Product criticality now uses
  `--app-critical-*`.*

## Buttons (marketing)
- **Primary:** `--color-button-primary-bg` (deep-blue) ·
  `--color-button-primary-text` (cream) ·
  `--color-button-primary-hover-overlay` rgba(0,0,0,.06).
- **Ghost:** `--color-button-ghost-border` · `--color-button-ghost-text`
  (deep-blue) · `--color-button-ghost-hover-bg` rgba(55,97,131,.08).
- **Amber (reserved CTA):** `--color-button-amber-bg` (amber) ·
  `--color-button-amber-text` (deep-blue).

The product's primary action does NOT use these: see `--app-primary` below.

## Forms (marketing)
`--color-input-bg` · `--color-input-border` · `--color-input-focus`
(deep-blue) · `--color-input-text` · `--color-input-placeholder`
(grey-blue). Error: `--color-error` **#B02A37** (marketing/light only; the
app uses the dark-tuned `--app-danger`).

## Status pills
`--color-pill-in-build-*` · `--color-pill-designed-*` ·
`--color-pill-planned-*`. *Legacy: currently unreferenced by any module
(the in-build pill was removed from the app hub). In-product status uses
the monochrome mono chip pattern, never these.*

## Shadows (marketing)
- `--shadow-card` 0 8px 32px rgba(55,97,131,.06)
- `--shadow-card-hover` 0 10px 36px rgba(55,97,131,.12)
- `--shadow-ink` 0 24px 64px rgba(0,0,0,.45)

## Watermark opacities
`--opacity-watermark-faint` .10 · `--opacity-watermark-soft` .15 ·
`--opacity-watermark-bug` .40 · `--opacity-watermark-amber` .08.

## Layout
`--container` 1200px · `--container-wide` 1360px · `--section-py` 5rem.

---

## PULSE product theme: "Instrument" (`--app-*`)
The authenticated app surface, and it is **fully dark**: a cool graphite
ground with hairline-seated panels, deliberately cooler and flatter than
the marketing ink so the two blacks read as different blacks. Strategy
approved 2026-07-10; locked decisions in the workspace `DESIGN.md`.

### Console (chrome: top bar, step rail, footers)
| Token | Value |
|---|---|
| `--app-console` | #12171C |
| `--app-console-raised` | #161C22 |
| `--app-console-edge` | #232C35 |
| `--app-on-console` | #EAEDEF |
| `--app-on-console-secondary` | #98A3AB |
| `--app-on-console-faint` | #828C95 |
| `--app-console-hairline` | rgba(233,236,238,.08) |
| `--app-console-hairline-strong` | rgba(233,236,238,.15) |

### Ground, surfaces, ink, lines
| Token | Value | Use |
|---|---|---|
| `--app-paper` | #0E1216 | page ground. **Legacy NAME pending rename; the value is dark.** Referenced only by `DashboardShell`; don't spread the name, panels sit on `--app-surface` |
| `--app-surface` | #161C22 | seated panels |
| `--app-surface-raised` | #1A212A | menus, popovers |
| `--app-surface-sunken` | #12171C | wells, read-only fields |
| `--app-ink` | #EAEDEF | body text |
| `--app-ink-secondary` | #98A3AB | supporting text |
| `--app-ink-muted` | #828C95 | non-essential metadata and placeholders (clears AA on every app surface; about 5.3:1 on sunken) |
| `--app-hairline` | rgba(233,236,238,.08) | dividers |
| `--app-border` | rgba(233,236,238,.15) | controls |
| `--app-border-strong` | rgba(233,236,238,.28) | hover |
| `--app-hover` | rgba(233,236,238,.06) | row/item hover tint |

All lines are translucent light, so they seat on any app surface.

### Signal / criticality (amber = criticality, the ONE product meaning)
`--app-signal` #F4C031 · `--app-signal-strong` #D9A61F · `--app-signal-wash`
rgba(244,192,49,.10) · `--app-signal-ink` **#ECC172** (amber as text on
dark) · `--app-signal-border` rgba(244,192,49,.42).

Critical items: `--app-critical-bg` rgba(244,192,49,.10) plus a full
`--app-critical-border` rgba(244,192,49,.42). Never a side-stripe.

### Primary action and states
- **Primary is structural white, never honey:** `--app-primary` #F1F3F5 ·
  `--app-primary-ink` #12171C · `--app-primary-hover` #FFFFFF.
- **Focus is structural white** (visible on every app surface, never
  confusable with the amber criticality read): `--app-focus` #F1F3F5 ·
  `--app-focus-on-console` #F1F3F5.
- Dark-tuned states: `--app-danger` #E8988A · `--app-danger-wash`
  rgba(232,120,100,.12) · `--app-danger-border` rgba(232,120,100,.45) ·
  `--app-success` #6FB39A · `--app-warning` #C9A24B.

### Elevation & radii
`--app-elev-1` and `--app-elev-2` (shadow plus a faint inset top light:
depth on dark) · `--app-elev-console` 0 24px 64px rgba(0,0,0,.45).
`--app-radius-sm` 8px · `--app-radius` 10px · `--app-radius-lg` 14px
(inputs 8 to 10, cards 12 to 14; never above 16px).

### Stage rail (monochrome; overrides the old done-goes-amber canon)
`--app-rail-line` rgba(233,236,238,.15) · `--app-rail-line-done` #828C95 ·
`--app-rail-node` #828C95 · `--app-rail-node-done` #98A3AB.
Done is a grey fill; current is a white ring. Amber returns to the rail
only if a stage itself is at risk.

### Instrument type
- `--app-font-sans` (Geist) · `--app-font-mono` (Geist Mono), from the
  `geist` npm package wired in `app/layout.js` (exposed as
  `--font-geist-sans` / `--font-geist-mono`, consumed only through the
  `--app-font-*` tokens).
- Scale (fixed rem, about 1.2 ratio): `--app-text-xs` 0.75 ·
  `--app-text-sm` 0.8125 · `--app-text-base` 0.9375 · `--app-text-md`
  1.0625 · `--app-text-lg` 1.375 · `--app-text-xl` 1.75.

---

## The produced document (`--doc-*`)
The Brief and its exports (MemberBriefView included) stand on these tokens,
never on `--app-*`. Warm paper framed by the dark tool; consumed from
Phase 4. Depth comes from typographic hierarchy and the earned drop shadow,
never from colour.

| Token | Value |
|---|---|
| `--doc-paper` | #FAFAF7 |
| `--doc-paper-2` | #F1F0EA |
| `--doc-ink` | #22231E |
| `--doc-ink-2` | #5C5D53 |
| `--doc-ink-3` | #6E6F63 |
| `--doc-line` | #E7E5DC |
| `--doc-navy` | #0B141E |
| `--doc-ochre` | #8A6A16 (criticality as text on paper) |
| `--doc-signal` | #F4C031 |

`--doc-font-serif` (Georgia stack; the document voice, never on instrument
surfaces) · `--doc-font-mono` (= `--app-font-mono`) · `--doc-radius` 3px ·
`--doc-shadow` (the earned drop shadow with an inset top light).

---

## Motion tokens
- **Easing:** `--ease-out` cubic-bezier(.23,1,.32,1) · `--ease-out-soft`
  (.16,1,.3,1) · `--ease-in-out` (.77,0,.175,1) · `--ease-drawer`
  (.32,.72,0,1).
- **Duration:** `--dur-press` 130 · `--dur-fast` 180 · `--dur-base` 240 ·
  `--dur-slow` 440 (ms).
- **Keyframes:** `flitrr-rise` · `flitrr-rise-sm` · `flitrr-pop` ·
  `flitrr-pulse`.
- **Utilities:** `.riseIn` · `.riseInSm` · `[data-reveal]` · `--rise-delay`
  (stagger) · `.tnum` (tabular figures).
