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
  pill in lock-step with criticalityAppearance; from sub-step 4 the amber
  census reads BOTH registers so a `--doc-*` amber can no longer pass it
  unseen, the Brief's criticality rules stay in lock-step with the paper
  mapping, the Brief's margin rail stays paired to its own numeral offset,
  and `--doc-*` is held to being a colour and face register: no `--doc-*`
  token may be consumed by a font-size or a spacing property anywhere in the
  repo, and no `--doc-*` name may imply a type size or a rhythm step. That
  last guard exists because the Brief's print block HAD become a second
  scale under `--doc-*`, 37 hand-picked font sizes and 52 hand-picked
  spacing declarations, and it is what stops a later session rebuilding the
  fork. From sub-step 5 the three Programme surfaces are in CONVERTED, their
  criticality rules are held to `criticalityAppearance` and their band rules
  to `scheduleBandAppearance`, and the tracker's variance ramp is held to
  both. Sub-step 6 adds the shared chrome (PageHeader, ViewOnlyBadge,
  DashboardShell), the project list, the dashboard and the workspace, with
  the amber census gaining the two shapes below. A sub-step adds its
  surfaces to CONVERTED as it converts them.) If your change fails one of
  these, fix the change, not the test.

Four things sit outside the plain rules on purpose. Each is stated in the
guard as a SHAPE, never as a file exemption or a class-name allowlist,
because the guard holds no exemption list. The first two are properties off
the rhythm and the scale; the last two are amber spends outside a
criticality-named rule, added in sub-step 6:

- **`scroll-margin-top` is not positive space.** It compensates for the
  height of sticky chrome so an anchored element lands below the header, so
  its correct value is whatever that chrome measures (the tracker's 24rem
  and 14rem). Snapping to the nearest step would be a 320px error that
  silently breaks scroll anchoring, and no static render would show it. Same
  category as the Brief's margin rail and the negative hit-area margins:
  geometry derived from another measurement, not a step on a scale.
- **A `font-size` may be a px length in an SVG-coordinate context.** A chart
  is drawn in a fixed viewBox, so its text sits in the same coordinate space
  as its bars and gridlines; a rem would scale with the root font size while
  the geometry did not, and labels would overrun their gridlines at exactly
  the accessibility setting meant to help. Chart text is part of the
  drawing, not of the document's type. The guard tests the real claim: every
  use of that class in the surface's own JS must be on an SVG `<text>` or
  `<tspan>`. It fails closed, so a class the JS never uses, or uses on an
  HTML element, does not get the allowance.
- **A ladder rung spends amber because exposure is not criticality.**
  Criticality is what an item THREATENS; the objective status ladder is how
  threatened an objective currently IS. `objectiveStatusAppearance` gives
  `at_risk` and `slipping` amber deliberately, because on the ladder amber
  brightens toward breach while red stays reserved for breach itself. The
  permission and the lock-step are one assertion: every amber token a rule
  spends must belong to ONE rung's appearance, and it must spend at least
  one. A rule that merely looks like a status name does not pass, and
  neither does one reaching for any other amber, including one that
  resolves to an identical value.
- **A brand mark spends amber because it means nothing at all.** A semantic
  amber must be perceivable and labelled (colour is never the only carrier),
  so a status is always announced. A brand mark is the inverse: hidden from
  assistive technology, and a fixed-size glyph rather than a run of type.
  The guard requires both, per class in the selector: every use in the
  surface's own JS sits on an `aria-hidden` element, AND the class is drawn
  at a fixed px width and height in that stylesheet. It admits PageHeader's
  pulse-line eyebrow mark and DashboardShell's Flitrr dot. It fails closed,
  and a status read cannot claim it without hiding itself from screen
  readers, which breaks the colour rule far more loudly. Know its width: it
  is structural, so it would also admit an amber decorative glyph that is
  not the brand's (the console chevron is the same shape). The prose rule
  below stays the authority on which chrome may be amber.

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

The scale is fixed rem: `--app-text-4xs` 0.5625 / `-3xs` 0.625 /
`-2xs` 0.6875 / `-xs` 0.75 / `-sm` 0.8125 / `-control` 0.875 /
`-base` 0.9375 / `-md` 1.0625 / `-ml` 1.1875 / `-lg` 1.375 / `-xl` 1.75 /
`-2xl` 2 / `-3xl` 2.5.

Sub-step 4 added the five outer steps for the **document register** the Brief
reads in, and they are one scale with the product's, not a second: `4xs` and
`3xs` below the old 0.6875 floor (mono furniture: matrix axes, authority
markers, criticality flags); `ml` filling the md-to-lg hole, which was a 1.29
jump where the rest of the ramp is about 1.08 and the Brief holds four
distinct sizes inside it; `2xl` and `3xl` as the two bounds of the document
masthead's fluid clamp, which is deliberately larger than an app page title.
A fluid size is legal ONLY as `clamp(<scale token>, <vw>, <scale token>)`:
the bounds ride the scale, the ramp between them does not.

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
  surfaces converge as their own sub-steps convert them. The eight steps
  never grew: a measure they cannot name on their own is **composed** from
  them in a `calc()` (the Brief's margin rail is a seat plus a gutter; a
  44px hit area is given back as negative margin), and the guard accepts a
  calc whose every length is a rhythm token and whose arithmetic carries no
  bare length.
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
status renders as Healthy). The seven:

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
- `varianceDirectionAppearance`: `ahead` / `on_baseline` / `behind`
  (`VARIANCE_DIRECTIONS` in `scheduleModel.js`), added in sub-step 5. The
  tone a tracker row reads in when it is NOT flagged. Ahead spends the
  success green because ahead is a recorded fact, not a verdict; on baseline
  spends no colour and drops to weight 500.

Two companions to the criticality mapping, added in sub-step 4:

- `criticalityMarkAppearance()`: the solid amber glyph that stands in for the
  Critical pill where no pill fits (a matrix pin, a rank square, a risk
  number, a milestone dot). The surface fixes the glyph's shape; the
  language fixes its ink. `scheduleBandAppearance('red')` spends the same
  amber for the same reason.
- `onPaper(appearance)`, with `criticalityAppearanceOnPaper(value)` and
  `criticalityMarkAppearanceOnPaper()`: the same appearance in the Brief's
  `--doc-*` register. `PAPER_COUNTERPART` is the ONLY place the two
  registers are tied together, so the document can keep its own ink without
  becoming a second source of what a colour means. It throws on a token with
  no counterpart rather than letting a surface pick a `--doc-*` colour
  locally. (The app's own print block had already remapped
  `--app-signal-ink` to `#856414`, which is `--doc-ochre` exactly.)

When converting a surface, express these through your module's classes but
take every colour from the appearance's tokens and keep its label, shape and
weight carriers.

The tracker's variance cell is the worked example of composing two mappings
rather than inventing a third. Its CSS shows five rungs, and the engine has
no five-value vocabulary: a flagged row takes its BAND
(`scheduleBandAppearance`), an unflagged row its DIRECTION
(`varianceDirectionAppearance`), in that precedence. When a surface's ramp
has more rungs than any one engine vocabulary, find the vocabularies it
composes. Never add the missing values to the design layer.

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
