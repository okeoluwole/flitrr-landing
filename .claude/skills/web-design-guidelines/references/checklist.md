# flitrr-landing — pre-ship UI checklist

## Surface & tokens
- [ ] Correct surface system: marketing = ink (`--color-ink-*` /
      `--color-on-ink-*`), app = Instrument (`--app-*`), light pages =
      `--color-*` semantic. Not mixed.
- [ ] No hardcoded hex or magic px — everything references a token from
      `app/globals.css` (add a token if one is missing).

## Amber discipline
- [ ] Amber used only for signal / criticality / primary CTA.
- [ ] Amber-as-text uses ochre (`--color-ochre` / `--app-signal-ink`), never raw
      amber.

## Typography
- [ ] Headings = Bricolage Grotesque, body = Inter; no new families.
- [ ] Sizes from the scale (marketing h1–h3 / `--app-text-*`).
- [ ] `.tnum` on money, dates, stage numerals.

## Spacing & layout
- [ ] `.container` for width; `--section-py` for section rhythm.
- [ ] Mobile-first; checked at the 768px breakpoint and up.

## Contrast (AA)
- [ ] Body text ≥4.5:1; large text / borders / icons ≥3:1.
- [ ] Placeholders use `--app-ink-secondary`; muted/faint tokens only for
      non-essential metadata, labels, or large text.

## Components
- [ ] Buttons use button tokens + existing press feedback; `<a>`-buttons have
      their own `:active`.
- [ ] Inputs: visible labels, `--app-focus` / `--color-input-focus` ring; errors
      via `--color-error` / `--app-danger` (text + colour, not colour alone).
- [ ] Cards: one shadow recipe per surface; critical = border + wash, not a
      side-stripe.

## Motion & accessibility
- [ ] All animation inside `@media (prefers-reduced-motion: no-preference)`;
      resting state fully visible.
- [ ] JS / canvas animation checks `prefers-reduced-motion` and bails.
- [ ] Motion uses easing/duration tokens; transform/opacity only; < ~300ms.
- [ ] Keyboard operable, visible focus, semantic HTML, headings in order.

## Print (if app layout touched)
- [ ] PULSE brief still exports clean (chrome hidden, brief in normal flow).
