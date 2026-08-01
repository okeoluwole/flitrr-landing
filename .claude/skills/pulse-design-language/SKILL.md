---
name: pulse-design-language
description: >-
  The PULSE app's design language (Session K, Note 15): the Instrument tokens
  in app/globals.css, the named type roles, the 4px spacing rhythm, the
  semantic mappings in lib/design/semantics.js (criticality, objective status
  ladder, severity band, stage state, programme variance, schedule band), the
  shared chrome (DashboardShell, PageHeader, ErrorNote, the wizard action
  bar), and the guard tests that keep it from drifting. Load before restyling
  or building ANY authenticated PULSE surface, including every Note 15
  sub-step (Action Log, Risk register, initiation flow, Brief views,
  Programme surfaces, dashboard and workspace).
---

# The PULSE design language

Defined once in Session K (the first sub-step of Note 15) so the five
sub-steps that follow, and every later surface, inherit one language instead
of re-deciding it. The sources of truth are code, not this file:

- **Tokens**: `app/globals.css`, the `--app-*` group ("PULSE product theme:
  Instrument") plus the `--doc-*` paper group (the Brief only) and the
  motion tokens (`--dur-*`, `--ease-*`).
- **Semantic mappings**: `lib/design/semantics.js`. Pure functions, one per
  domain. Never re-pick a domain colour locally.
- **Shared chrome**: `app/components/DashboardShell.js` and
  `app/pulse/app/components/` (`PageHeader`, `ErrorNote`, `CriticalityChip`,
  `SeverityTag` with its `SeverityLegend`, `ViewOnlyBadge`, `DateField`).
- **Guard tests**: `tests/designTokenGuard.test.js` (no raw colour literal in
  any app CSS module), `tests/designSemantics.test.js` (mappings complete,
  loud on unknown values, in lock-step with the engines),
  `tests/designContrast.test.js` (AA on every semantic pairing), and
  `tests/designSurfaceGuard.test.js` (on every converted surface: type rides
  the --app-text scale, positive space rides the --app-space rhythm, amber
  only inside criticality-named rules, SeverityTag in lock-step with
  severityBandAppearance, CriticalityChip and the wizard's classification
  pill in lock-step with criticalityAppearance; a sub-step adds its surfaces
  to CONVERTED as it converts them). If your change fails one of these, fix
  the change, not the test.

This file records the rules and the vocabulary. Where it and the code ever
disagree, the code wins; update this file in the same commit.

## The two colour rules (Note 15, locked)

1. **Colour is tied to meaning and carries nothing decorative.**
   - Amber = criticality, only. Never status, progress, done-ness, chrome or
     decoration. The one amber chrome element is the PULSE pulse-line mark.
   - Danger red = breach (Compromised) and failed writes, only.
   - Success green = recorded facts (met, ahead), never a status verdict.
   - The focus ring and the primary action are structural white, so neither
     can be confused with the criticality read.
2. **Colour is never the only carrier.** Every semantic state also reads
   through its label, shape or weight (fill presence, border style, ring vs
   disc vs bullseye marks), so the surface holds for a colour-blind lender
   and in a printed or exported document. Text meets WCAG AA on the surface
   it sits on; the contrast test computes this from the real tokens.

## Colour

All values live in `app/globals.css`; consume by name, never by value. A
genuinely new shade is added there as a token first. The print block remaps
the whole `--app-*` group to dark-on-white; a raw literal would not remap,
which is one of the reasons the guard test exists.

- Ground and surfaces: `--app-ground`, `--app-surface`,
  `--app-surface-raised`, `--app-surface-sunken`, the `--app-console*` chrome
  group.
- Ink: `--app-ink` (body), `--app-ink-secondary` (supporting, placeholders),
  `--app-ink-muted` (non-essential metadata only).
- The translucent-light ramp, one alpha per job, one RGB base:
  `--app-hover` .06 (hover tint), `--app-fill-faint` .04 (disabled or
  resting tile), `--app-fill` .07 (neutral chip and pill fill),
  `--app-hairline` .08 (dividers), `--app-active` .09 (press state),
  `--app-fill-strong` .14 (mid intensity fill), `--app-border` .15,
  `--app-border-strong` .28. Do not invent a ninth alpha.
- Signal: `--app-signal`, `--app-signal-ink`, `--app-signal-ink-dim`,
  `--app-signal-wash`, `--app-critical-bg`, `--app-critical-border`. A
  criticality wash always takes a full border, never a side-stripe.
- Action and states: `--app-primary(-ink/-hover)`, `--app-focus`,
  `--app-focus-ring`, `--app-danger(-wash/-border)`, `--app-success`,
  `--app-warning`.

## Type

Geist (`--app-font-sans`) carries the voice; Geist Mono (`--app-font-mono`)
carries the numeric instrument voice: money, dates, stage numerals,
criticality scores, reference ids, and every micro-label. Sentence case;
uppercase only on mono micro-labels. No display faces in-product.

The scale is fixed rem: `--app-text-2xs` 0.6875 / `-xs` 0.75 / `-sm` 0.8125 /
`-control` 0.875 / `-base` 0.9375 / `-md` 1.0625 / `-lg` 1.375 / `-xl` 1.75.
Consume a **role**, not a raw size:

| Role | Face | Weight | Size | Notes |
|---|---|---|---|---|
| Page title | sans | 600 | xl | lh 1.15, ls -0.02em; PageHeader owns it |
| Section title | sans | 600 | md | lh 1.3 |
| Card title | sans | 600 | base | lh 1.4 |
| Body | sans | 400 | base | lh 1.55, max 56 to 65ch |
| Caption | sans | 400 | sm | ink-secondary |
| Control label | sans | 500 to 600 | control | buttons, links, menu items |
| Micro label | mono | 500 | 2xs | uppercase; tracked 0.14em (eyebrows) or 0.05em (chips) |
| Data | mono | 400 to 500 | xs to sm | tabular numerals (`.tnum` or `font-variant-numeric`) |

## Spacing, shape, depth, focus

- Rhythm: `--app-space-1` 0.25rem to `--app-space-8` 4rem, a 4px base.
  Micro gaps 1 and 2, control padding 2 and 3, panel padding 4 and 5, block
  gaps 6, section rhythm 7 and 8. New work consumes the scale; shipped
  surfaces converge as their own sub-steps convert them.
- Radii: `--app-radius-sm` 8 (inputs, buttons), `--app-radius` 10,
  `--app-radius-lg` 14 (seated panels). Chips are pills (999px); severity
  tags are 4px. Nothing above 16px.
- Depth: `--app-elev-1` on seated panels, `--app-elev-2` on raised popovers.
  Panels seat on hairlines; they never float as gapped cards.
- Focus: `outline: 2px solid var(--app-focus)` with offset 2 (or -2 inside
  rows); `--app-focus-ring` for a paired soft glow. White everywhere.
- Touch: 44px minimum targets on the phone-first surfaces (use `::after`
  hit pseudos where the visual is smaller).

## Motion

Only where it aids comprehension, never decoration: state change, save,
reveal, menu. `--dur-press` 130 / `--dur-fast` 180 / `--dur-base` 240 with
the `--ease-out` family; everything behind
`@media (prefers-reduced-motion: no-preference)`.

## The semantic mappings

`lib/design/semantics.js` is the ONLY place a domain value becomes a token.
Each function throws on an unknown value (a silent fallback is how a wrong
status renders as Healthy). The six:

- `criticalityAppearance`: `critical` / `standard` / `unlinked`. Pill shape.
  Critical is the amber wash plus full border; Standard the quiet outline;
  Needs a link the dashed governance gap.
- `objectiveStatusAppearance`: `healthy` / `at_risk` / `slipping` /
  `compromised` / `not_scored` (Session B4's ladder). Calm spends no colour;
  the amber outline brightens with exposure; Compromised is the one filled
  label, in danger red, because amber is exposure and red is breach.
- `severityBandAppearance`: `serious` / `moderate` / `minor` / `unscored`
  (Session B3). A monochrome intensity ramp in the 4px tag shape. Severity
  is how bad; criticality is what it threatens; the axes never blur.
- `stageStateAppearance`: `sequential` / `concurrent` / `complete`
  (Session A). Concurrent is dashed (running beside); complete is faint and
  labelled (the past, never deleted).
- `programmeVarianceAppearance`: `baseline` / `current` / `forecast` /
  `drift` (Session B2's chart series). The baseline is quiet and solid; the
  observed position bright and filled; the forecast hollow and dashed
  (derived, not observed); drift a dashed secondary connector.
- `scheduleBandAppearance`: engine `green` / `amber` / `red`, rendered as
  On course (hollow ring) / Slipping (bright mono disc) / Critical slip
  (amber bullseye). Red is criticality-gated by the engine, so Critical slip
  is the one amber read; the engine keys never appear as words on a surface.

When converting a surface, express these through your module's classes but
take every colour from the appearance's tokens and keep its label, shape and
weight carriers. The per-row variance direction ramp (`ahead` /
`on_baseline` / `behind`) converts with the Programme tracker in its own
sub-step.

## The shared chrome

- `DashboardShell`: the 56px console bar. Flitrr wordmark plus marketing
  amber dot; the pulse-line glyph belongs to PULSE surfaces, not this bar.
- `PageHeader` (`app/pulse/app/components/PageHeader.js`): EVERY authenticated
  surface opens with it. Canonical order: back link, eyebrow (mono
  micro-label; `eyebrowMark` adds the pulse-line glyph on PULSE-titled
  pages), title row (title, then `meta` and `actions` right), the stage line
  (Session E's chip, derived through `stageLabel` from
  `lib/engine/stageNames.js`; pass `stage` wherever the page holds
  `current_stage`), project name, the `badge` slot (ViewOnlyBadge), intro
  `sub`. Do not hand-build a header again.
- Back-link wording: module surfaces say "Back to the workspace" (M9.5a);
  the gate says "Back to the brief"; the hub-level pages "Back to projects".
- `SeverityTag` (`app/pulse/app/components/SeverityTag.js`): the one severity
  band expression, label and colours from `severityBandAppearance`, with the
  engine-derived `SeverityLegend` beside it. A surface never writes its own
  severity classes, the same way it never re-picks criticality's pill.
- `ErrorNote`: the one failure voice. `role="alert"`, sans sm 600 in
  `--app-danger`, text plus tone, never colour alone, hidden in print.
  In-flight is a button label swap with an ellipsis ("Saving…"); success is
  silent (optimistic) except recorded-fact lines; never invent a new
  failure presentation.
- The flow action bar (the wizard footer): Back left; Save & Exit then the
  white primary Save & Continue right. Under 540px it stacks column-reverse,
  full width, primary on top. A held primary NAMES its blocker in
  `.footerHint` (role="status", aria-describedby) rather than reading as a
  refusal; ProgrammeSetup's `BlockerHint` is the same affordance.
- The 9-step initiation rail: monochrome by intensity (`--app-rail-*`);
  reached grey fill, current bright ring; never amber.
- The module tab bar (ProgrammeTracking): mono labels, roving tabindex, and
  the panel rule is scoped `.schedulePanel:not([hidden])` so an author
  display never beats the user-agent [hidden] rule. Preserve that scoping
  in any restyle.

## Conventions (unchanged, locked)

CSS Modules, no Tailwind. No em or en dashes anywhere, in code, copy or
comments. UK spelling. Exact casing: Flitrr, PULSE, STACK, ROUTE. Operability
stays governance-shaped: never owner or due-date on the register or the
Action Log. Stage names come from `lib/engine/stageNames.js`, verbatim,
never re-typed.

## The review route

`/pulse/app/design` renders the whole language behind auth: palette, type
roles, spacing, radii and focus, and every semantic mapping as labelled
swatches. It is a review surface for the Note 15 sweep only, linked from no
navigation. **The last sub-step of the sweep deletes the route
(`app/pulse/app/design/`).**
