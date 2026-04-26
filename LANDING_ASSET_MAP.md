# Landing Asset Map

**Status:** Planning document only — no code changes in this task.
**Companion to:** `LANDING_REWRITE_PLAN.md`
**Purpose:** Concrete asset integration map naming exact files from
`C:/Users/okeol/OneDrive/Documents/FLITRR-Brand Assets/` for every
visual position in the rewritten 11-section landing page.

---

## Locked Decisions Summary

| Decision | Value |
|---|---|
| Accent 1 hex | **`#376183`** (deep institutional blue — supersedes the `#37653D` documented in the previous rewrite plan) |
| Background | `#F4C031` amber/yellow |
| Foreground | `#F2F0F4` off-white |
| Accent 2 | `#7793A8` grey-blue |
| Accent 3 | `#B5BCCA` light grey-blue |
| Heading font | **Montserrat ExtraBold (800)** |
| Body / nav / UI font | **Inter** |
| Retired | Playfair Display, Plus Jakarta Sans, every map-pin variant |
| Pilot framing | "Design partner" formal; "pilot" only in short CTAs |
| Project Brief release | Q3 2026 (design-partner access) |
| PULSE | Implicit acronym — never spell out |
| Page structure | 11 sections (Project Brief Deep-Dive added) |

> **Map-pin sweep:** the brand pack folders `logo-files/` and
> `profile-icons/` likely contain the retired map-pin lockup (combined
> wordmark + map-pin-with-star). The folder `profile-logos/` is the
> safer source for the standalone F mark and clean wordmark. Filenames
> are colour-coded (`accent1`, `color`, `transparent`, etc.) and do
> **not** disclose whether the asset includes the pin — so every file
> selected below requires a visual confirmation pass before Task 3
> imports it. This is captured in **Part F**.

---

## Part A — Inventory of Usable Assets

All paths below are relative to:
`C:/Users/okeol/OneDrive/Documents/FLITRR-Brand Assets/`

### A1. Wordmark files (Flitrr wordmark, no map-pin)

The wordmark is most likely to live cleanly inside `profile-logos/basic/`
(square-canvas variants of the brand mark, designed for avatars and
social profile use). The `logo-files/basic/` set is **assumed to carry
the full lockup including the retired map-pin** and is therefore
**excluded from the wordmark inventory** pending visual verification.

| Path | Variant | Format | Use |
|---|---|---|---|
| `profile-logos/basic/accent1.svg` | Accent 1 (deep blue `#376183`) on default surface | SVG | **Primary nav wordmark on Foreground sections** |
| `profile-logos/basic/accent1-transparent.svg` | Accent 1 on transparent | SVG | **Primary nav wordmark over Hero amber** |
| `profile-logos/basic/inverse-transparent.svg` | Inverse (light wordmark) on transparent | SVG | Wordmark on dark Accent 1 surfaces (Footer CTA, Footer) |
| `profile-logos/basic/white-transparent.svg` | Pure white on transparent | SVG | Fallback for dark backgrounds if `inverse` reads wrong |
| `profile-logos/basic/black-transparent.svg` | Pure black on transparent | SVG | Reserved (not used on the live site) |
| `profile-logos/basic/color.svg` | Full-colour variant | SVG | Reserved — only if it reads as wordmark-only after visual check |

PDFs and PNGs at the same paths are kept as fallbacks for print or
canvas where SVG is unavailable. **Web rendering uses SVG only.**

### A2. F-mark files (geometric F, no map-pin)

The standalone F geometric mark is most likely to live in
`profile-icons/basic/` — but per the brief, profile-icons is also
where map-pin variants live. **Visual confirmation required (Part F).**
The list below is the candidate set; if profile-icons turns out to be
contaminated with map-pin lockups, the F mark must be sourced from
`profile-logos/` or extracted from one of the cleaner letterheads.

| Path | Variant | Format | Use |
|---|---|---|---|
| `profile-icons/basic/accent1.svg` | F mark in Accent 1 (`#376183`) | SVG | **F mark beside wordmark in Nav (light surfaces)** |
| `profile-icons/basic/accent1-transparent.svg` | Accent 1 F mark, transparent bg | SVG | **F mark over Hero amber, document mock watermark** |
| `profile-icons/basic/inverse-transparent.svg` | Inverse F mark | SVG | F mark on Accent 1 surfaces (Footer CTA watermark) |
| `profile-icons/basic/white-transparent.svg` | White F mark | SVG | Fallback on Accent 1 surfaces |
| `profile-icons/basic/black-transparent.svg` | Black F mark | SVG | Reserved |

### A3. Social / Open Graph assets

The `facebook-covers/minimalist/` and `facebook-covers/professional/`
folders contain pre-laid-out brand banners that are the closest
existing material to a 1200×630 OG image. The `c-vector-*` series
appears to be a templated grid; `minimalist-left.pdf` /
`professional-left.pdf` look like cleaner standalone covers.

| Path | Use | Format |
|---|---|---|
| `facebook-covers/minimalist/minimalist-left.pdf` | Source artwork for OG image — re-export at 1200×630 with PULSE wordmark added | PDF |
| `facebook-covers/professional/professional-left.pdf` | Alternate OG source if `minimalist-left` reads too quiet | PDF |
| `facebook-covers/minimalist/minimalist-left-2.pdf` | Alternate composition | PDF |

**Note:** none of these can be used unmodified as the OG image until
the map-pin sweep is verified. Final OG image will likely be a
purpose-built composite (amber background, F mark, "PULSE — The
discipline to start right" headline) rather than a brand-pack pull.
This is flagged in Part F.

### A4. Mockups / context shots

The `mockups/` folder is **not used on the landing page** — the
flagship visual is the Project Brief document mock (custom SVG, see
Part E.3), not a phone-in-hand context shot. The iPhone/Android
mockups read as consumer-app marketing imagery and would mis-cue the
B2B SME-developer audience.

The only mockup of incidental interest:

| Path | Use |
|---|---|
| `mockups/signage/window.png` | Reserved — possibly usable in a future "About / Company" page, not on the landing |

### A5. Presentation / document templates (reference only)

Not used directly on the landing page. Used as the typography and
treatment reference to keep the live site consistent with brand
collateral.

| Path | Reference for |
|---|---|
| `presentations/basic-1.pptx` … `basic-5.pptx` | Type hierarchy, slide rhythm |
| `presentations/simple-1.pptx`, `simple-2.pptx` | Minimal section treatments |
| `presentations/pitch-1.pptx` … `pitch-12.pptx` | Brand colour usage in context, F-mark placement |
| `letterheads/blank-1-a4.docx` (and the full `blank-*` / `original-*` set) | Header/footer treatment of wordmark + F mark |

If typography weights for Montserrat ExtraBold need cross-checking
(e.g. tracking, optical size), open `pitch-1.pptx` and inspect the
title-slide settings. **No standalone brand guidelines PDF exists in
the folder.**

---

## Part B — Section-by-Section Asset Map

All file paths below are relative to
`C:/Users/okeol/OneDrive/Documents/FLITRR-Brand Assets/`. The
typography scale referenced (H1, H2, etc.) is fully defined in **Part
C**. The colour tokens (`--color-…`) are defined in **Part D**.

---

### Section 1 — Nav

- **B1. Background fill:** transparent over hero amber initially;
  switches to Foreground `#F2F0F4` with a 1px Accent 3 bottom border
  on scroll.
- **B2. Primary brand asset:**
  - F mark: `profile-icons/basic/accent1-transparent.svg` rendered
    at **32×32px**, left of the wordmark, 12px gap.
  - Wordmark: `profile-logos/basic/accent1-transparent.svg` rendered
    at **height 24px**, vertical centre.
  - On scroll (Foreground bg): both swap to the non-transparent
    `accent1.svg` variants for crisper anti-aliasing.
- **B3. Watermark / decorative asset:** none.
- **B4. Typography:**
  - Nav links: **Inter 500, 15px / 0.9375rem, line-height 1, tracking
    -0.005em, colour `--color-text-primary`** (Accent 1).
  - CTA pill ("Join the pilot"): **Inter 600, 14px / 0.875rem,
    tracking 0.005em, colour Foreground on Accent 1 fill**.
- **B5. In-house elements:** hamburger icon — three horizontal Accent
  1 bars 20×2px, 4px apart, animating to an X on open. SVG built
  inline.
- **B6. CTAs:**
  - Primary CTA pill: fill `--color-accent-1-deep-blue`, text
    `--color-foreground-cream`, 12px vertical / 20px horizontal
    padding, 999px radius. Hover: fill darkens 6% via overlay.
  - No ghost button in nav.

---

### Section 2 — Hero

- **B1. Background fill:** `--color-surface-hero` (Background amber
  `#F4C031`), full-bleed.
- **B2. Primary brand asset:**
  - F mark: `profile-icons/basic/accent1-transparent.svg` rendered
    at **120×120px** as a quiet motif **inside the Hero document mock**
    upper-right corner at 10% opacity (see Part E.3).
  - The visible nav wordmark above acts as the primary brand
    presence — no second wordmark in the Hero copy column.
- **B3. Watermark / decorative asset:** the F mark (above) doubles
  as the watermark on the document mock.
- **B4. Typography:**
  - Eyebrow: **Inter 600, 13px / 0.8125rem, uppercase, tracking
    0.12em, colour Accent 1.** Reads: *"Introducing PULSE — by
    Flitrr."*
  - H1: **Montserrat ExtraBold (800), clamp(40px, 6vw, 72px) /
    clamp(2.5rem, 6vw, 4.5rem), line-height 1.05, tracking -0.02em,
    colour Accent 1.** Reads: *"Monitoring What Matters."*
  - Body Large: **Inter 400, 19px / 1.1875rem, line-height 1.55,
    colour Accent 1 at 85%** (i.e. mixed with amber surface for
    softer secondary read).
- **B5. In-house elements:** **Project Brief document mock** in the
  right column (see Part E.3 for full SVG spec).
- **B6. CTAs:**
  - Primary "Join the PULSE pilot": fill Accent 1, text Foreground,
    14px/22px padding, 8px radius, Inter 600 16px.
  - Ghost "See the Project Brief →": 1.5px Accent 1 border, Accent 1
    text, transparent fill. Hover: fill becomes Accent 1 at 8%
    opacity.

---

### Section 3 — Pain

- **B1. Background fill:** `--color-surface-section` (Foreground
  `#F2F0F4`).
- **B2. Primary brand asset:** none — prose-only section.
- **B3. Watermark / decorative asset:** F mark
  `profile-icons/basic/accent3.svg` at **240×240px, opacity 0.15**,
  positioned bottom-right of the section, half-clipped by the section
  edge.
- **B4. Typography:**
  - H2: **Montserrat ExtraBold (800), clamp(32px, 4.5vw, 52px),
    line-height 1.1, tracking -0.015em, colour Accent 1.** Reads:
    *"Most projects are lost before they start."*
  - Body Regular: **Inter 400, 18px / 1.125rem, line-height 1.65,
    colour Accent 1 at 90%.**
- **B5. In-house elements:** thin Accent 3 horizontal rule (1px) as
  a paragraph separator if rhythm calls for it.
- **B6. CTAs:** none in this section.

---

### Section 4 — Thesis (glass-ball / rubber-ball)

- **B1. Background fill:** `--color-surface-section` (Foreground).
- **B2. Primary brand asset:** none.
- **B3. Watermark / decorative asset:** none — the glass/rubber
  panels carry the visual weight.
- **B4. Typography:**
  - H2: **Montserrat ExtraBold (800), 44px, line-height 1.1, Accent 1.**
    Reads: *"Not every objective is equal. PULSE knows the difference."*
  - Panel headings ("GLASS" / "RUBBER"): **Montserrat ExtraBold,
    24px, uppercase, tracking 0.04em, Accent 1.**
  - Panel body lines: **Inter 500, 16px, line-height 1.5, Accent 1.**
  - Closer ("Glass shatters. Rubber bounces. Know the difference."):
    **Montserrat ExtraBold, 20px, Accent 1, centred.**
- **B5. In-house elements:**
  - **Glass-ball icon** (Part E.1) — 64×64px in the GLASS panel.
  - **Rubber-ball icon** (Part E.2) — 64×64px in the RUBBER panel.
  - **Glass/Rubber comparison panels** (Part E.6) — two-column layout.
- **B6. CTAs:** none.

---

### Section 5 — How It Works

- **B1. Background fill:** `--color-surface-hero` (Background amber)
  — alternates with the Foreground sections above and below for rhythm.
- **B2. Primary brand asset:** F mark
  `profile-icons/basic/accent1-transparent.svg` at **80×80px**,
  upper-left of the section heading area, opacity 1 (full F mark
  reads as a quiet brand bug, not a watermark).
- **B3. Watermark / decorative asset:** none beyond B2.
- **B4. Typography:**
  - H2: **Montserrat ExtraBold (800), 44px, Accent 1.** Reads: *"From
    blank page to formal brief in fifteen minutes."*
  - Sub: **Inter 400, 18px, line-height 1.55, Accent 1 at 85%.**
  - Step heading (H3): **Montserrat ExtraBold, 22px, Accent 1.**
  - Step body: **Inter 400, 16px, line-height 1.6, Accent 1 at 90%.**
- **B5. In-house elements:** **Step badges** (Part E.4) — 56×56px
  numbered circles, one per step.
- **B6. CTAs:** none in this section (the CTAs sit in Hero, Pilot,
  and Footer CTA).

---

### Section 6 — Project Brief Deep-Dive (NEW)

- **B1. Background fill:** `--color-surface-section` (Foreground).
- **B2. Primary brand asset:** none.
- **B3. Watermark / decorative asset:** F mark
  `profile-icons/basic/accent3.svg` at **320×320px, opacity 0.10**,
  pinned to the right edge of the section behind the document mock.
- **B4. Typography:**
  - Eyebrow: **Inter 600, 13px, uppercase, tracking 0.12em, Accent 2.**
    Reads: *"PULSE Module 1 — Project Brief."*
  - H2: **Montserrat ExtraBold (800), 48px, Accent 1.** Reads: *"The
    discipline to start right."*
  - Body Large: **Inter 400, 19px, line-height 1.55, Accent 1.**
  - Pull-quote (the £50K line): **Montserrat ExtraBold, 28px,
    line-height 1.25, Accent 1.**
- **B5. In-house elements:**
  - A second, larger version of the **Project Brief document mock**
    (see Part E.3) at **600×760px viewBox**, showing more detail than
    the Hero version: section headers, glass/rubber pills inside
    "Objectives", a bottom export bar reading "Export PDF · Export
    Word."
  - Three labelled callouts (Inter 500, 14px, Accent 2) pointing to
    parts of the document mock with thin Accent 3 leader lines:
    *"15-minute guided elicitation," "Glass-ball / rubber-ball
    classification," "Exportable in two formats."*
- **B6. CTAs:**
  - Single ghost CTA: **"See an example brief →"** (Accent 1 outline,
    Accent 1 text). Future-anchored — links to a sample PDF when
    available; for v1 anchors to `#pilot`.

---

### Section 7 — PULSE Modules (formerly "What You Get")

- **B1. Background fill:** `--color-surface-section` (Foreground).
- **B2. Primary brand asset:** none in the section header.
- **B3. Watermark / decorative asset:** F mark
  `profile-icons/basic/accent3.svg` at **40×40px, opacity 0.40**, in
  the upper-right corner of **each module card** as a brand bug.
- **B4. Typography:**
  - H2: **Montserrat ExtraBold (800), 44px, Accent 1.** Reads:
    *"PULSE: four modules, one discipline."*
  - Sub: **Inter 400, 18px, line-height 1.55, Accent 2.**
  - Module name (H3): **Montserrat ExtraBold, 22px, Accent 1.**
  - Module body: **Inter 400, 16px, line-height 1.55, Accent 2.**
  - Module module-tagline (Project Brief card only): **Inter 500
    italic, 15px, Accent 1.** Reads: *"The discipline to start right."*
  - Status pill: **Inter 600, 12px, uppercase, tracking 0.06em.**
- **B5. In-house elements:**
  - **Module status pills** (Part E.5) — three variants: "In build,"
    "Designed," "Planned."
  - Card frame: Foreground fill, 1px Accent 3 border, 12px radius,
    24px internal padding.
- **B6. CTAs:** none — the Pilot section converts.

---

### Section 8 — Pilot

- **B1. Background fill:** `--color-surface-hero` (Background amber)
  — anchors the conversion moment.
- **B2. Primary brand asset:** F mark
  `profile-icons/basic/accent1.svg` at **48×48px**, top of the form
  card, centred.
- **B3. Watermark / decorative asset:** none — the amber surface is
  the visual.
- **B4. Typography:**
  - H2: **Montserrat ExtraBold (800), 44px, Accent 1.** Reads: *"Be a
    PULSE design partner."*
  - Sub: **Inter 400, 18px, line-height 1.55, Accent 1.**
  - Block heading (H3): **Montserrat ExtraBold, 18px, Accent 1.**
  - Block body: **Inter 400, 16px, line-height 1.6, Accent 1 at 90%.**
  - Form labels: **Inter 500, 14px, Accent 1.** (Visible labels, not
    sr-only — for clarity on conversion-critical fields.)
  - Form footnote: **Inter 400, 13px, Accent 2.**
- **B5. In-house elements:** form card on Foreground, 16px radius,
  Accent 3 1px border, 32px padding. Inputs: 1px Accent 3 border,
  Foreground fill, Accent 1 text, 12px radius, focus state Accent 1
  border.
- **B6. CTAs:**
  - Primary "Request a design-partner spot": fill Accent 1, text
    Foreground, full-width inside the form card, 16px/24px padding,
    8px radius, Inter 600 16px.

---

### Section 9 — FAQ

- **B1. Background fill:** `--color-surface-section` (Foreground).
- **B2. Primary brand asset:** none.
- **B3. Watermark / decorative asset:** F mark
  `profile-icons/basic/accent3.svg` at **200×200px, opacity 0.12**,
  bottom-left, half-clipped.
- **B4. Typography:**
  - H2: **Montserrat ExtraBold (800), 44px, Accent 1.** Reads:
    *"Questions we get asked."*
  - Question (button): **Inter 600, 17px, line-height 1.4, Accent 1.**
  - Answer: **Inter 400, 16px, line-height 1.65, Accent 2.**
- **B5. In-house elements:** chevron icon — 16×16px, Accent 1 stroke
  1.5px, rotates 180° on open. Accent 3 1px divider between items.
- **B6. CTAs:** none.

---

### Section 10 — Footer CTA

- **B1. Background fill:** `--color-surface-cta-band` (Accent 1
  deep blue `#376183`), full-bleed.
- **B2. Primary brand asset:** none in the foreground.
- **B3. Watermark / decorative asset:** F mark
  `profile-icons/basic/inverse-transparent.svg` (or
  `white-transparent.svg`) at **400×400px, opacity 0.08**, positioned
  behind the heading.
- **B4. Typography:**
  - H2: **Montserrat ExtraBold (800), 44px, Foreground `#F2F0F4`.**
    Reads: *"Ten design-partner spots. First come, first served."*
  - Body: **Inter 400, 18px, line-height 1.55, Foreground at 85%.**
- **B5. In-house elements:** none beyond the watermark.
- **B6. CTAs:**
  - Primary "Request a design-partner spot": fill Background amber
    `#F4C031`, text Accent 1, 16px/28px padding, 8px radius, Inter
    600 16px. Hover: fill darkens 6% via overlay. **This is the only
    place on the page where amber appears as a CTA fill, pulling the
    Hero brand colour through to the closing moment.**

---

### Section 11 — Footer

- **B1. Background fill:** `--color-surface-cta-band` (Accent 1
  deep blue) — **continuous with Section 10** to create one unified
  dark band as the page's terminal beat.
- **B2. Primary brand asset:**
  - Wordmark: `profile-logos/basic/inverse-transparent.svg` at
    height **28px**, top-left of the footer block.
  - F mark beside it: `profile-icons/basic/inverse-transparent.svg`
    at **28×28px**, 12px gap.
- **B3. Watermark / decorative asset:** none.
- **B4. Typography:**
  - Tagline: **Montserrat ExtraBold (800), 18px, Foreground.** Reads:
    *"Monitoring What Matters."*
  - Sub-tagline: **Inter 400, 14px, Foreground at 70%.** Reads:
    *"Flitrr is the company behind PULSE."*
  - Footer link: **Inter 500, 14px, Foreground at 85%.** Hover:
    Foreground at 100%.
  - Copy: **Inter 400, 13px, Foreground at 60%.**
- **B5. In-house elements:** thin Accent 1 lighter-tint divider
  (Accent 1 mixed with 15% white) between the brand block and the
  copyright row.
- **B6. CTAs:** none.

---

## Part C — Typography Scale

Single reference table for the entire site. All sizes follow a 1.25
type scale rounded to nearest sensible px. All colours are token
references (see Part D).

| Role | Font | Weight | Size (px / rem) | Line-height | Tracking | Colour |
|---|---|---|---|---|---|---|
| H1 (Hero headline) | Montserrat | 800 | clamp(40, 6vw, 72) / clamp(2.5, 6vw, 4.5) | 1.05 | -0.02em | `--color-text-primary` |
| H2 (Section heading) | Montserrat | 800 | 44 / 2.75 | 1.1 | -0.015em | `--color-text-primary` |
| H3 (Subsection / module heading) | Montserrat | 800 | 22 / 1.375 | 1.25 | -0.01em | `--color-text-primary` |
| Eyebrow | Inter | 600 | 13 / 0.8125 | 1 | 0.12em (uppercase) | `--color-text-primary` or `--color-text-secondary` |
| Body Large (lead) | Inter | 400 | 19 / 1.1875 | 1.55 | 0 | `--color-text-primary` |
| Body Regular | Inter | 400 | 16 / 1 | 1.6 | 0 | `--color-text-primary` (light bg) / `--color-text-secondary` (cards) |
| Body Small (caption / footnote) | Inter | 400 | 13 / 0.8125 | 1.5 | 0.005em | `--color-text-secondary` |
| Button Primary | Inter | 600 | 16 / 1 | 1 | 0.005em | `--color-foreground-cream` (on Accent 1 fill) |
| Button Ghost | Inter | 600 | 16 / 1 | 1 | 0.005em | `--color-text-primary` (on transparent) |
| Nav Link | Inter | 500 | 15 / 0.9375 | 1 | -0.005em | `--color-text-primary` |
| Pull-quote | Montserrat | 800 | 28 / 1.75 | 1.25 | -0.01em | `--color-text-primary` |
| Status pill | Inter | 600 | 12 / 0.75 | 1 | 0.06em (uppercase) | per-variant (see Part E.5) |

**Font loading:** Montserrat ExtraBold (800) and Inter (400 / 500 /
600) loaded from Google Fonts via `next/font/google` in
`app/layout.js`. Subsets: `latin`. Display: `swap`.

---

## Part D — Colour Token System

To be implemented in `app/globals.css` (Task 3) under `:root`.
Variable names follow the pattern `--color-{role}-{descriptor}` for
raw colours and `--color-{semantic}` for semantic aliases.

```css
:root {
  /* Raw palette — locked brand colours */
  --color-background-amber:        #F4C031;
  --color-foreground-cream:        #F2F0F4;
  --color-accent-1-deep-blue:      #376183;
  --color-accent-2-grey-blue:      #7793A8;
  --color-accent-3-light-grey-blue:#B5BCCA;

  /* Semantic text tokens */
  --color-text-primary:   var(--color-accent-1-deep-blue);
  --color-text-secondary: var(--color-accent-2-grey-blue);
  --color-text-muted:     var(--color-accent-3-light-grey-blue);
  --color-text-inverse:   var(--color-foreground-cream);

  /* Semantic surface tokens */
  --color-surface-hero:        var(--color-background-amber);
  --color-surface-section:     var(--color-foreground-cream);
  --color-surface-cta-band:    var(--color-accent-1-deep-blue);
  --color-surface-card:        var(--color-foreground-cream);

  /* Borders & dividers */
  --color-border:        var(--color-accent-3-light-grey-blue);
  --color-border-strong: var(--color-accent-2-grey-blue);
  --color-divider-on-dark: rgba(242, 240, 244, 0.15);

  /* Interactive states */
  --color-button-primary-bg:       var(--color-accent-1-deep-blue);
  --color-button-primary-text:     var(--color-foreground-cream);
  --color-button-primary-hover-overlay: rgba(0, 0, 0, 0.06);

  --color-button-ghost-border:     var(--color-accent-1-deep-blue);
  --color-button-ghost-text:       var(--color-accent-1-deep-blue);
  --color-button-ghost-hover-bg:   rgba(55, 97, 131, 0.08);

  --color-button-amber-bg:         var(--color-background-amber);
  --color-button-amber-text:       var(--color-accent-1-deep-blue);

  /* Form inputs */
  --color-input-bg:        var(--color-foreground-cream);
  --color-input-border:    var(--color-border);
  --color-input-focus:     var(--color-accent-1-deep-blue);
  --color-input-text:      var(--color-text-primary);
  --color-input-placeholder: var(--color-accent-2-grey-blue);

  /* Status pills (PULSE Modules) */
  --color-pill-in-build-bg:    var(--color-accent-1-deep-blue);
  --color-pill-in-build-text:  var(--color-foreground-cream);
  --color-pill-designed-bg:    var(--color-accent-3-light-grey-blue);
  --color-pill-designed-text:  var(--color-accent-1-deep-blue);
  --color-pill-planned-bg:     var(--color-foreground-cream);
  --color-pill-planned-border: var(--color-accent-3-light-grey-blue);
  --color-pill-planned-text:   var(--color-accent-2-grey-blue);

  /* Watermark opacity (used in section watermarks) */
  --opacity-watermark-faint:  0.10;
  --opacity-watermark-soft:   0.15;
  --opacity-watermark-bug:    0.40;
}
```

**Legacy variables to retire** in `globals.css`: `--accent`,
`--accent-dark`, `--text`, `--muted`, `--bg`, `--border`, `--error`
(if `--error` is still needed for form errors, define a new
`--color-error: #B02A37` token explicitly — the previous palette
brought this in but it isn't part of the locked brand and should be
treated as a UI-only token).

---

## Part E — Visual Elements to Create In-House

Each item below is a written specification only. Task 3 will produce
the actual SVG.

### E.1. Glass-ball icon

- **viewBox:** `0 0 64 64`.
- **Geometry:** circle centred at (32, 32), radius 26.
- **Stroke:** Accent 1 `#376183`, 2px, no fill (transparent inside)
  except for a Foreground fill mask if the icon sits over a non-
  Foreground surface.
- **Highlight:** a smaller ellipse in the upper-left (centre roughly
  22, 22; rx 7, ry 4; rotation -30°) filled at 60% Foreground to
  suggest a glass surface. No second stroke on the highlight.
- **Subtle shadow ground (optional):** an Accent 3 ellipse beneath
  the sphere (centre 32, 56; rx 14, ry 2; opacity 0.5) for visual
  weight on Foreground surfaces.

### E.2. Rubber-ball icon

- **viewBox:** `0 0 64 64`.
- **Geometry:** circle centred at (32, 32), radius 26.
- **Fill:** solid Accent 1 `#376183`. No stroke. No highlight.
- **Shadow ground (optional):** matching Accent 3 ellipse beneath
  for parity with the glass icon (centre 32, 56; rx 14, ry 2;
  opacity 0.5).
- **Visual parity rule:** glass and rubber are rendered at the same
  pixel size, same baseline, same shadow ground. The only difference
  the eye reads is "outline + highlight" vs "solid fill."

### E.3. Project Brief document mock (Hero + Deep-Dive)

- **viewBox:** `0 0 480 600` (Hero); a larger `0 0 600 760` variant
  for the Deep-Dive section with more inner detail.
- **Outer card:** rounded rectangle, x=0 y=0 w=480 h=600, radius 16,
  fill `--color-foreground-cream`, drop-shadow `0 8px 32px
  rgba(55, 97, 131, 0.18)`.
- **Header band:** top 64px strip; left side displays the F mark
  `profile-icons/basic/accent1.svg` at 28×28; right side a small
  pill reading "PROJECT BRIEF" in Inter 600 11px Accent 2.
- **Section labels** (left-aligned, Montserrat ExtraBold 13px,
  uppercase, tracking 0.08em, Accent 1):
  - VISION
  - OBJECTIVES
  - GLASS-BALL
  - RUBBER-BALL
  - CONSTRAINTS
  - STAKEHOLDERS
  Each followed by 2–3 horizontal lines at Accent 2 1.5px stroke,
  rounded ends, varying widths (e.g. 92%, 78%, 64% of the body
  column) to suggest typeset content without rendering text.
- **Dividers:** 1px Accent 3 between sections.
- **Watermark:** F mark
  `profile-icons/basic/accent1-transparent.svg` at 120×120 in the
  upper-right inside the card, opacity 0.10.
- **Bottom export bar (Deep-Dive variant only):** 48px strip at the
  bottom with two pill icons reading "PDF" and "DOCX" in Inter 600
  11px Accent 1 on Accent 3 background.

### E.4. Step badges (How It Works)

- **viewBox:** `0 0 56 56`.
- **Circle:** fill Accent 1, no stroke, radius 26 centred at
  (28, 28).
- **Numeral:** "1", "2", "3" centred, **Montserrat ExtraBold 800,
  24px, Foreground `#F2F0F4`**.
- **Position:** rendered above the step heading, 16px gap.
- **Variant for amber-bg sections:** if Section 5 keeps the amber
  background, the badge stays Accent 1 fill (high contrast against
  amber).

### E.5. Module status pills (PULSE Modules)

All pills: 999px radius, padding 6px vertical / 14px horizontal,
Inter 600 12px uppercase tracking 0.06em.

| Pill | Background | Text colour | Border |
|---|---|---|---|
| **IN BUILD** | `--color-pill-in-build-bg` (Accent 1) | `--color-pill-in-build-text` (Foreground) | none |
| **DESIGNED** | `--color-pill-designed-bg` (Accent 3) | `--color-pill-designed-text` (Accent 1) | none |
| **PLANNED** | `--color-pill-planned-bg` (Foreground) | `--color-pill-planned-text` (Accent 2) | 1px `--color-pill-planned-border` (Accent 3) |

Used on each of the four module cards: Project Brief = IN BUILD ·
Q3 2026; Action Tracker = DESIGNED · Build to follow; Risk Register =
DESIGNED · Build to follow; Programme Tracker = DESIGNED · Build to
follow; (optional fifth) Portfolio Dashboard = PLANNED.

### E.6. Glass / Rubber comparison panels (Thesis)

- **Layout:** two columns, 50/50 split with a 32px gap; on viewport
  ≤ 768px, stacks to one column.
- **Each panel:** Foreground fill, 1px Accent 3 border, 16px radius,
  32px internal padding. Centred content.
- **Left panel (GLASS):**
  - Header: "GLASS" Montserrat ExtraBold 24px Accent 1, uppercase,
    centred.
  - Icon: glass-ball SVG (Part E.1) at 64×64px, centred, 16px below
    header.
  - Three example objectives below the icon (Inter 500 16px Accent 1,
    line-height 1.5, centred):
    1. *Practical completion by 31 March*
    2. *Planning consent retained*
    3. *GIA ≥ 4,200 m²*
- **Right panel (RUBBER):**
  - Header: "RUBBER" same treatment as GLASS.
  - Icon: rubber-ball SVG (Part E.2) at 64×64px, centred.
  - Three example objectives:
    1. *Bathroom tile spec*
    2. *Soft-strip start date ±2 weeks*
    3. *Internal door supplier*
- **Vertical divider on desktop:** a single 1px Accent 3 vertical
  rule centred between the two panels (rendered inside the gap, not
  inside either panel) at 60% panel height.

---

## Part F — Open Asset Questions

These are the gaps and ambiguities Task 3 must not improvise around.
Each requires a quick visual confirmation pass (open the file in an
image viewer) or a yes/no from Olu.

1. **Map-pin contamination check across `profile-icons/basic/` and
   `profile-logos/basic/`.** Filenames are colour-coded only —
   nothing in the name reveals whether the asset includes the
   retired map-pin-with-star icon. Before Task 3 imports any of
   these into the page, **open each candidate file (Part A1 and A2
   tables) and confirm it is wordmark-only / F-mark-only with no
   pin**. If a folder turns out to be entirely contaminated, the
   clean source falls back to extracting the wordmark and F mark
   from one of the `letterheads/blank-1-a4.docx` templates, which
   are the most likely to use the pin-free brand lockup.

2. **Standalone F mark vs square-padded F mark.** `profile-icons/`
   and `profile-logos/` both produce square assets (designed for
   social avatars). For Nav and watermark use, an unpadded F mark
   on a transparent background is preferred — the
   `*-transparent.svg` variants should deliver this, but the
   internal padding (whitespace inside the SVG viewBox) varies and
   may need trimming. Confirm whether to (a) use the assets as-is
   and rely on container sizing, or (b) re-export trimmed F-mark
   SVGs in a new `flitrr-landing/public/brand/` folder.

3. **Open Graph / social preview image.** No existing brand-pack
   asset is a clean 1200×630 OG image without modification. Confirm
   approach: (a) build a custom OG image (amber background, F mark,
   "PULSE — The discipline to start right" headline) as part of
   Task 3, or (b) defer OG image to a later task and ship without
   one in the first cut.

4. **Favicon source.** No favicon currently exists on the site and
   no `.ico` is present in the brand pack. Easiest path: export the
   F mark from `profile-icons/basic/accent1.svg` to a 32×32 and
   16×16 PNG and a multi-resolution `.ico`. Confirm this approach.

5. **Montserrat ExtraBold (800) availability.** Google Fonts ships
   Montserrat with all weights including 800. **No action needed
   unless** the brand spec implies a specific Montserrat licence /
   foundry (e.g. the original commercial Montserrat from Julieta
   Ulanovsky). Confirm Google Fonts version is acceptable.

6. **Inter weight set.** The typography scale uses Inter at 400,
   500, 600. Confirm no need for 700 (the Pull-quote and other
   "weighty body" cases are handled by Montserrat ExtraBold instead
   of Inter 700, which is the intended discipline — but a final
   confirm).

7. **F-mark colour for watermarks on amber surfaces.** Watermarks
   on Foreground sections use `accent3.svg` (light grey-blue) at
   low opacity for a quiet read. On amber surfaces (Hero, How It
   Works, Pilot), the equivalent quiet treatment is **Accent 1 at
   low opacity** — but we currently only inventoried the
   `*-transparent` variants. Confirm whether the `accent1` F mark
   reads as a watermark at 0.10–0.15 opacity on amber, or whether
   we need a softer brand bug — possibly Accent 2 in that role.

8. **Project Brief document mock — sample content.** The mock uses
   stylised lines (no rendered text) for the body of each section,
   which avoids inventing project specifics. Confirm this is the
   right read for the Hero — alternative is to render legible
   placeholder copy for one of the six sections (e.g. "VISION:
   Deliver a 28-unit BTR scheme by Q4 2027") which is more
   evocative but reintroduces the "invented project name" problem
   that Task 1 flagged in the existing dashboard mock.

---

**End of Landing Asset Map.**
