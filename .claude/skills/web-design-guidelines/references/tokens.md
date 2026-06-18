# flitrr-landing — token reference

Source of truth: **`app/globals.css`**. Values below mirror it; if they ever
drift, the CSS wins. Never hardcode these values — reference the custom property.

## Brand palette (locked — `LANDING_ASSET_MAP.md` Part D)
| Token | Value |
|---|---|
| `--color-background-amber` | #F4C031 |
| `--color-foreground-cream` | #F2F0F4 |
| `--color-accent-1-deep-blue` | #376183 |
| `--color-accent-2-grey-blue` | #7793A8 |
| `--color-accent-3-light-grey-blue` | #B5BCCA |

## Semantic — light / marketing base
- **Text:** `--color-text-primary` (deep-blue) · `--color-text-secondary`
  (grey-blue) · `--color-text-muted` (light-grey-blue, *non-essential only*) ·
  `--color-text-inverse` (cream).
- **Surfaces:** `--color-surface-hero` (amber) · `--color-surface-section`
  (cream) · `--color-surface-cta-band` (deep-blue) · `--color-surface-card`
  (cream).
- **Borders:** `--color-border` · `--color-border-strong` ·
  `--color-divider-on-dark`.

## Ink theme — marketing ground
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

## Amber-as-text / criticality
- `--color-ochre` **#8A6A16** — amber's text-safe sibling. One meaning
  everywhere: the thing that matters. Use wherever amber would be text.
- `--color-critical-card-border` rgba(212,165,39,.55) ·
  `--color-critical-card-bg` #FFFCF4.

## Buttons
- **Primary:** `--color-button-primary-bg` (deep-blue) ·
  `--color-button-primary-text` (cream) ·
  `--color-button-primary-hover-overlay` rgba(0,0,0,.06).
- **Ghost:** `--color-button-ghost-border` · `--color-button-ghost-text`
  (deep-blue) · `--color-button-ghost-hover-bg` rgba(55,97,131,.08).
- **Amber (reserved CTA):** `--color-button-amber-bg` (amber) ·
  `--color-button-amber-text` (deep-blue).

## Forms
`--color-input-bg` · `--color-input-border` · `--color-input-focus` (deep-blue)
· `--color-input-text` · `--color-input-placeholder` (grey-blue). Error:
`--color-error` **#B02A37**.

## Status pills (PULSE)
- **in-build:** `--color-pill-in-build-bg` (deep-blue) / `-text` (cream)
- **designed:** `--color-pill-designed-bg` (light-grey-blue) / `-text` (deep-blue)
- **planned:** `--color-pill-planned-bg` (cream) / `-border` / `-text` (grey-blue)

## Shadows
- `--shadow-card` 0 8px 32px rgba(55,97,131,.06)
- `--shadow-card-hover` 0 10px 36px rgba(55,97,131,.12)
- `--shadow-ink` 0 24px 64px rgba(0,0,0,.45)

## Watermark opacities
`--opacity-watermark-faint` .10 · `--opacity-watermark-soft` .15 ·
`--opacity-watermark-bug` .40 · `--opacity-watermark-amber` .08.

## Layout
`--container` 1200px · `--container-wide` 1360px · `--section-py` 5rem.

---

## PULSE product theme — "Instrument" (`--app-*`)
The authenticated app surface: dark console chrome around a cool paper canvas.

### Console (chrome)
`--app-console` (=ink-950) · `--app-console-raised` (=ink-900) ·
`--app-console-edge` (=ink-700) · text `--app-on-console` / `-secondary` /
`-faint` · `--app-console-hairline` / `-strong`.

### Paper (canvas + cards) — the only genuinely new neutrals
| Token | Value |
|---|---|
| `--app-paper` | #F5F8FB |
| `--app-surface` | #FFFFFF |
| `--app-surface-sunken` | #EEF2F7 |
| `--app-ink` | #1B2A3A |
| `--app-ink-secondary` | #51677C |
| `--app-ink-muted` | #7C93A6 |
| `--app-hairline` | #E4E9EF |
| `--app-border` | #D6DEE7 |
| `--app-border-strong` | #B7C3CF |

### Signal / criticality / states
`--app-signal` (=amber) · `--app-signal-strong` (=amber-deep) ·
`--app-signal-wash` · `--app-signal-ink` (=ochre, amber-as-text) ·
`--app-signal-border`. `--app-critical-bg` / `--app-critical-border`.
`--app-focus` (deep-blue) · `--app-focus-on-console` (amber) · `--app-danger`
(=error) · `--app-success` #15795F · `--app-warning` (=ochre).

### Elevation & radii
`--app-elev-1` · `--app-elev-2` · `--app-elev-console` (=shadow-ink).
`--app-radius-sm` 8px · `--app-radius` 10px · `--app-radius-lg` 14px.

### Pulse-line rail (signature motif)
`--app-rail-line` · `--app-rail-line-done` (amber) · `--app-rail-node` ·
`--app-rail-node-done` (amber).

### Instrument type scale (~1.2 ratio)
`--app-text-xs` 0.75 · `--app-text-sm` 0.8125 · `--app-text-base` 0.9375 ·
`--app-text-md` 1.0625 · `--app-text-lg` 1.375 · `--app-text-xl` 1.75 (rem).

---

## Motion tokens
- **Easing:** `--ease-out` cubic-bezier(.23,1,.32,1) · `--ease-out-soft`
  (.16,1,.3,1) · `--ease-in-out` (.77,0,.175,1) · `--ease-drawer` (.32,.72,0,1).
- **Duration:** `--dur-press` 130 · `--dur-fast` 180 · `--dur-base` 240 ·
  `--dur-slow` 440 (ms).
- **Keyframes:** `flitrr-rise` · `flitrr-rise-sm` · `flitrr-pop` · `flitrr-pulse`.
- **Utilities:** `.riseIn` · `.riseInSm` · `[data-reveal]` · `--rise-delay`
  (stagger) · `.tnum` (tabular figures).
