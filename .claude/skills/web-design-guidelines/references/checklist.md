# flitrr-landing: pre-ship UI checklist

## Surface & tokens
- [ ] Correct surface system: marketing = ink (`--color-ink-*` /
      `--color-on-ink-*`), app = Instrument dark (`--app-*`), the Brief and
      its exports = `--doc-*` paper, light brand pages = `--color-*`
      semantic. Not mixed.
- [ ] No hardcoded hex or magic px; everything references a token from
      `app/globals.css` (add a token if one is missing).
- [ ] New app work doesn't spread the legacy `--app-paper` name (the shell
      owns the ground; panels sit on `--app-surface`).

## Amber discipline
- [ ] In-product, amber = criticality only. Not status, not progress, not
      done states, not decoration, not chrome (sole exception: the
      pulse-line mark in the shell top bar).
- [ ] Amber-as-text uses `--app-signal-ink` on the dark instrument and
      ochre (`--color-ochre` / `--doc-ochre`) on light or paper surfaces;
      never raw amber as text on light.
- [ ] Product primary actions are structural white (`--app-primary`), never
      amber.
- [ ] The stage rail stays monochrome: done = grey fill, current = white
      ring (`--app-rail-*`).
- [ ] Marketing: amber only for signal / criticality / the reserved CTA.

## Typography
- [ ] Product: Geist (`--app-font-sans`) + Geist Mono (`--app-font-mono`);
      no display faces in-product; sizes from `--app-text-*`, never the
      marketing clamp scale.
- [ ] Mono carries the numeric voice (money, dates, stage numerals, scores,
      reference ids) and the micro-labels (chips, eyebrows, captions);
      uppercase only on mono micro-labels, sentence case everywhere else.
- [ ] Marketing: Bricolage headings / Inter body / Archivo on the
      Considered pages; no new families.
- [ ] `.tnum` wherever sans sets numbers.

## Spacing & layout
- [ ] Marketing: `.container` for width; `--section-py` for section rhythm.
- [ ] Mobile-first; checked at the 768px breakpoint and up.
- [ ] 44px touch targets on phone-first product surfaces.

## Contrast (AA)
- [ ] Body text at 4.5:1 or better; large text / borders / icons at 3:1 or
      better, on the actual surface they sit on.
- [ ] Product body copy sets in `--app-ink` or `--app-ink-secondary`;
      `--app-ink-muted` only for non-essential metadata and placeholders
      (it clears AA on every app surface, about 5.3:1 on sunken wells).
- [ ] Marketing: `--color-on-ink-faint` / `--color-text-muted` only for
      metadata, labels, or large text.

## Components
- [ ] Product buttons: white primary (`--app-primary` +
      `--app-primary-ink`), ghost with `--app-border`, danger
      `--app-danger`; every control ships default, hover, focus, active,
      disabled. Marketing buttons use the `--color-button-*` tokens.
- [ ] Focus ring is `--app-focus` (structural white) in-product,
      `--color-input-focus` on marketing forms; visible on every surface.
- [ ] Inputs: visible labels; errors text + colour, never colour alone;
      read-only fields on `--app-surface-sunken` with no focus ring.
- [ ] Work surfaces use the register panel pattern: one seated panel,
      hairline-divided rows, `--app-hover` row hover. Not floating card
      grids.
- [ ] Critical = `--app-critical-bg` wash + full `--app-critical-border`;
      never a side-stripe. Severity reads monochrome apart from critical:
      no RAG traffic lights in the register.
- [ ] Chips: mono, 11px, uppercase, monochrome by intensity; no amber for
      status.
- [ ] Product bans hold: no glassmorphism, no gradient text, no side-stripe
      borders, no display fonts in-product, no radius above 16px on cards.
- [ ] Operability stays governance-shaped: no owner or due-date fields on
      the register or the Action Log.

## Motion & accessibility
- [ ] All animation inside `@media (prefers-reduced-motion: no-preference)`;
      resting state fully visible.
- [ ] JS / canvas animation checks `prefers-reduced-motion` and bails.
- [ ] Motion uses easing/duration tokens; transform/opacity only.
- [ ] In-product: 150 to 250ms, state change only, no page-load
      choreography.
- [ ] Keyboard operable, visible focus, semantic HTML and landmarks,
      headings in order.

## Print (if app layout or the Brief touched)
- [ ] The Brief still exports clean: console chrome hidden, the sheet in
      normal document flow, on `--doc-*` paper (never dark).
