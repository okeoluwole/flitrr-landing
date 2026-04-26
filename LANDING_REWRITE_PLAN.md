# Landing Rewrite Plan

**Status:** Planning document only — no code changes in this task.
**Scope:** End-to-end audit of the current `flitrr-landing` site against
the new Flitrr / PULSE strategy, with section-by-section rewrite
recommendations.

---

## Strategic Frame (the truth being rewritten toward)

- **Flitrr** (sentence case, double-r) is the parent **brand / company**.
- **PULSE** (all caps) is Flitrr's **first product** — a programme
  delivery platform for SME real estate developers in the UK and Nigeria.
- PULSE is composed of four (eventually five) modules:
  **Project Brief, Action Tracker, Risk Register, Programme Tracker,
  Portfolio Dashboard**. **None are live.** Project Brief is being built
  first (Milestone 2).
- The flagship value proposition is **Project Brief**: a guided
  elicitation flow that produces a formal, exportable Project Brief
  document — the kind of artefact a consultancy like Turner & Townsend
  would charge ~£50K for. PULSE produces it for free in 15 minutes.
- Signature framing: **"glass-ball / rubber-ball"** — a method of
  categorising objective criticality that decides what gets flagged.
- **Locked taglines:**
  - Flitrr (brand): *Monitoring What Matters*
  - PULSE Project Brief (module): *The discipline to start right*

### Brand & visual decisions (locked)

- **Use:** colour palette, F geometric mark (no map pin), Flitrr
  wordmark, typography system.
- **Do not use:** map-pin-with-star icon in any variant.
- **Asset folder confirmed at:**
  `C:/Users/okeol/OneDrive/Documents/FLITRR-Brand Assets/`
  with subfolders: `logo-files/{basic,gradient,special,texture,animation}`,
  `presentations/`, `letterheads/`, `business-cards/`, `mockups/`,
  `profile-icons/`, `profile-logos/`, `facebook-*`, `instagram/`.
  **No standalone brand guidelines PDF found** — typography spec needs
  to be extracted from a `.pptx` template or decided by Olu (see Open
  Questions).
- **Colour palette (use these exact hex codes everywhere):**
  - Background `#F4C031` (amber — hero, primary brand surface)
  - Foreground `#F2F0F4` (off-white — section backgrounds, neutral)
  - Accent 1 `#37653D` (deep green — primary text/headers/CTAs/F mark)
    *Note: the swatch reads visually blue but the hex `#37653D` is
    forest green. Hex is treated as canonical here; flagged for
    confirmation in Open Questions.*
  - Accent 2 `#7793A8` (grey-blue — secondary text)
  - Accent 3 `#B5BCCA` (light grey-blue — borders, dividers, muted
    surfaces)

### Current structural problems (cross-cutting)

1. The page treats **FLITRR** as the product name. It should treat
   **Flitrr** as the brand and **PULSE** as the product. Every
   product-level claim must be re-attributed to PULSE.
2. The page positions **Action Tracking** as the live, flagship module.
   Per the new strategy, **Project Brief is the flagship and is being
   built first**, and **nothing is live yet**.
3. Current colour system uses `#0d5a3d` / `#10b981` / `#fafaf9` /
   `#1a1a1a`. **All five locked brand colours are missing.**
4. Current typography uses Playfair Display + Plus Jakarta Sans (Google
   Fonts). The brand pack typography has not been confirmed; this may
   need to change.
5. The Hero "dashboard mock" invents three project names
   (Thornfield Residential, Parkview Commercial, Marina Quarter) and
   a non-existent "Action Tracker"-style portfolio view. Both the
   placeholder content and the implied product UI are wrong for the new
   positioning, where the flagship artefact is a **Project Brief
   document**, not a portfolio dashboard.
6. The "glass-ball / rubber-ball" framing — central to PULSE's
   identity — is **entirely absent**.

---

## Section 1 — Nav

### A. What it currently says

- Wordmark renders as plain text "FLITRR" (all caps).
- Links: Platform · Pilot · About · **Join Pilot** (CTA pill).
- Sticky behaviour with scroll shadow; hamburger on mobile.

### B. What's wrong with it

- Wordmark is the literal string "FLITRR" in all caps. The brand is
  **Flitrr** (sentence case, double-r) and the brand pack contains a
  proper wordmark SVG that should be used in place of typed text.
- Brand identity is not represented — the geometric **F mark** doesn't
  appear next to the wordmark.
- The `Platform` link implies a single platform-named product; under
  the new model this anchor should point to a section about **PULSE**
  (the product), not "the platform" generically.
- No way for a visitor to understand the brand → product hierarchy
  (Flitrr is parent, PULSE is its first product).

### C. What it should say

- Replace the "FLITRR" text wordmark with the **Flitrr wordmark SVG**
  (Accent 1 `#37653D`) plus the **F geometric mark** to its left
  (also Accent 1).
- Updated link set:
  - **PULSE** → anchors to the product section
  - **Project Brief** → anchors to the flagship-module section
  - **Pilot** → anchors to the pilot section
  - **About** → anchors to the footer/about block
  - CTA pill: **Join the pilot** (Accent 1 fill, Foreground text)
- Wordmark `aria-label` becomes `Flitrr — Monitoring What Matters`.

### D. Visual assets needed

- F mark (basic, Accent 1 variant) — left of wordmark.
- Flitrr wordmark (basic, Accent 1 variant).
- Background: Foreground `#F2F0F4` when scrolled, transparent over the
  amber hero before scroll.

---

## Section 2 — Hero

### A. What it currently says

- Eyebrow: *"Programme Delivery · AI-Assisted"*
- Headline: **"Monitoring What Matters."**
- Subheadline: *"FLITRR is a programme delivery platform built for SME
  real estate developers — bringing institutional discipline to how you
  manage your portfolio."*
- CTAs: **Join the pilot** (primary) and *See how it works →* (ghost).
- Right column: invented-portfolio dashboard mock with three named
  projects ("Thornfield Residential" 72%, "Parkview Commercial" 48% at
  risk, "Marina Quarter" 88%) and aggregate stats (14 open actions, 3
  critical flags, 3 projects).

### B. What's wrong with it

- Headline is right at brand level (*Monitoring What Matters* is the
  locked Flitrr tagline) but the section currently attributes it to
  "FLITRR the product" rather than "Flitrr the brand introducing its
  first product, PULSE."
- Subheadline calls FLITRR a "programme delivery platform" — that is
  PULSE's description, not Flitrr's. Brand vs product is conflated.
- The dashboard mock implies the live product is a portfolio
  view ("Live" pill, action counts, named developments). Under the new
  strategy nothing is live, and the flagship artefact is a **Project
  Brief document**, not a dashboard.
- Project names ("Thornfield…", "Marina Quarter") are placeholder
  fiction and should not appear on a public marketing site.
- Background is currently `#fafaf9` (off-white). The locked palette
  puts amber `#F4C031` as the hero / primary brand surface.
- "AI-Assisted" eyebrow is fine but undersells the elicitation
  flow; it should hint at the Project Brief's value.

### C. What it should say

- **Eyebrow:** *Introducing PULSE — by Flitrr*
- **Headline:** *Monitoring What Matters.*
  (Keep the locked Flitrr tagline as the H1.)
- **Subheadline:**
  *Flitrr builds programme delivery tools for SME real estate
  developers. Our first product, **PULSE**, gives you the discipline
  the big consultancies sell for £50K — starting with the document
  every project should begin with.*
- **CTAs:**
  - Primary: **Join the PULSE pilot** → `#pilot`
  - Ghost: **See the Project Brief →** → `#project-brief`
- **Right-column visual (replace the dashboard mock):** an abstract
  representation of the **Project Brief artefact** — a stylised
  document outline (sections like Vision, Objectives, Glass-ball
  criteria, Rubber-ball criteria, Constraints, Stakeholders) rendered
  as a clean card on the amber hero. No invented project names. No
  portfolio metrics. The card should read as *"the document PULSE
  produces,"* not *"the dashboard PULSE shows."*
- Strip all references to invented developments, action counts, and
  "Live" pills.

### D. Visual assets needed

- Hero background: Background amber `#F4C031` (full-bleed).
- F geometric mark (large, Accent 1 `#37653D`) as a quiet motif behind
  the heading or in the upper left of the visual card.
- Document-style hero illustration (custom build): cream/Foreground
  card with Accent 1 headers, Accent 2 secondary text, Accent 3
  dividers. No map-pin imagery anywhere.
- Primary CTA: Accent 1 fill, Foreground text. Ghost CTA: Accent 1
  outline, Accent 1 text.

---

## Section 3 — The Pain

### A. What it currently says

- Heading: *"You're tracking everything. And seeing nothing."*
- Three prose paragraphs:
  1. WhatsApp updates at 11pm, contractor issues lost in minutes,
     actions agreed Monday and forgotten by Friday.
  2. ~40 open items across four projects, no way to triage routine vs
     budget-killer.
  3. Big consultancies solved this; SMEs were locked out.

### B. What's wrong with it

- The pain narrative is **action-tracking pain** ("actions agreed and
  forgotten", "open items"). That's the right pain for a project that
  has already started — but PULSE's flagship is the **Project Brief**,
  whose pain is upstream: projects starting **without a clear,
  agreed, exportable brief**, leading to scope creep, mis-priced
  contracts, mis-aligned consultants, and the very mess the current
  paragraphs describe.
- The pain is symptom-level. The new positioning needs root-cause
  pain: *you started without a brief, so everything downstream broke.*
- "Four projects" framing is too prescriptive — many SME developers
  have 1–3 projects, not 4.

### C. What it should say

- **Heading:** *Most projects are lost before they start.*
- **Body (three paragraphs):**
  1. *You sketched the project on the back of a feasibility model.
     The architect built to one assumption, the QS priced to another,
     the contractor priced to a third. By month three you're
     reconciling four versions of "the plan" — none of them written
     down, none of them signed off.*
  2. *Scope creeps. Costs drift. Programme slips. The consultants
     blame each other, the contractor blames the consultants, and
     you carry the cost of every misalignment because nobody agreed
     what "done" looked like before work started.*
  3. *The big consultancies solved this decades ago with a single
     discipline: a formal Project Brief, written before a spade hits
     the ground. They charge ~£50K to produce one. SME developers have
     been locked out — until now.*

### D. Visual assets needed

- Background: Foreground `#F2F0F4`.
- No imagery required — let the prose carry the section.
- Optional: a small Accent 3 horizontal rule between paragraphs, or
  a faint F-mark watermark in Accent 3 in the corner.

---

## Section 4 — The Thesis

### A. What it currently says

- Heading: *"One platform. Built for how real estate programmes
  actually run."*
- Body: FLITRR helps developers monitor what matters across every
  project — actions, risks, milestones, critical path tagged to scope/
  cost/time/quality.
- Closer: *"No more hunting. No more chasing. No more surprises."*
- Right column: a 2×2 quadrant labelled SCOPE / COST / TIME / QUALITY.

### B. What's wrong with it

- The thesis is generic programme-management governance. The new
  strategic thesis is more specific and more powerful: **objective
  criticality categorised via the glass-ball / rubber-ball framing.**
- The Iron Triangle quadrant (Scope / Cost / Time / Quality) is
  generic PMI/PRINCE2 language. PULSE's signature is **glass-ball
  vs. rubber-ball objectives** — a binary classification of every
  project objective into "drop it and it shatters" (glass) vs. "drop
  it and it bounces" (rubber). This determines what gets flagged as
  critical action. The Iron Triangle quadrant should be replaced with
  this framing.
- "One platform" headline reinforces the brand-as-product confusion.

### C. What it should say

- **Heading:** *Not every objective is equal. PULSE knows the
  difference.*
- **Body:**
  *Every project carries dozens of objectives, but they aren't equally
  load-bearing. Some are **glass-ball** — drop them and the project
  shatters. Some are **rubber-ball** — drop them and the project
  bounces. Most teams treat them the same, which is why the
  catastrophic ones blindside you and the trivial ones consume your
  Monday morning.*
  *PULSE asks the question consultancies spend weeks asking on your
  behalf — what is glass, and what is rubber — and uses the answer to
  decide what gets flagged, what gets escalated, and what gets quietly
  tracked. Discipline, scaled.*
- **Closer (kept tight):** *Glass shatters. Rubber bounces. Know the
  difference.*
- **Right-column visual (replace the Iron Triangle quadrant):** a
  two-panel comparison — left panel "GLASS" with stylised glass
  sphere icon and 2–3 example glass-ball objectives (e.g. "Practical
  completion by 31 March", "Planning consent retained",
  "GIA ≥ 4,200 m²"); right panel "RUBBER" with rubber/ball icon and
  example rubber-ball objectives (e.g. "Bathroom tile spec",
  "Soft-strip start date ±2 weeks", "Internal door supplier").
  Visual treatment in Accent 1 with Accent 2 secondary text.

### D. Visual assets needed

- Background: Foreground `#F2F0F4` (or alternating with Hero amber if
  rhythm calls for it).
- Two custom icons: a **glass sphere** (Accent 1 outline, Foreground
  fill) and a **rubber ball** (Accent 1 fill). Neither exists in the
  brand pack — would need to be commissioned or drawn in-house.
- F mark optional as a quiet watermark.

---

## Section 5 — How It Works

### A. What it currently says

- Heading: *"From sign-up to clarity in under an hour."*
- Three numbered steps:
  1. **Add your projects** — enter active developments, define critical
     milestones.
  2. **Invite your team** — internal team, consultants, contractors;
     they log actions/updates.
  3. **See what matters** — every action AI-tagged to scope/cost/time/
     quality, flagged against critical milestones.

### B. What's wrong with it

- Describes how **Action Tracking** works, not how **PULSE Project
  Brief** works.
- "Adding projects" and "inviting team" are not the entry point of the
  flagship module. The Project Brief is a guided elicitation flow — a
  conversational/structured Q&A that ends in an exportable document.
- "Under an hour" is too long for the Project Brief flagship; the
  promise is **15 minutes**.
- AI tagging is real but is a downstream feature, not the headline.

### C. What it should say

- **Heading:** *From blank page to formal brief in fifteen minutes.*
- **Sub:** *PULSE Project Brief takes you through the same elicitation
  a senior consultant would walk you through — and exports the
  document at the end.*
- **Three steps:**
  1. **Answer the questions.** *PULSE walks you through the questions
     a senior project manager would ask on day one — vision,
     objectives, constraints, stakeholders, success criteria. No PM
     jargon. No blank Word document.*
  2. **Classify what matters.** *For every objective you name, PULSE
     asks one question: glass or rubber? In ten minutes you have the
     criticality map most projects never get.*
  3. **Export the brief.** *Download a formal Project Brief — the
     same document a consultancy would charge £50K to write — ready
     to share with your architect, QS, contractor, and lender.*

### D. Visual assets needed

- Background: Background amber `#F4C031` (alternates with Section 4's
  Foreground).
- Step number badges: Accent 1 circle with Foreground numerals, or
  the F mark stylised as a step badge.
- Optional small inline illustration per step (form / glass-rubber
  toggle / document export). No map pins.

---

## Section 6 — What You Get (Live Today + In Development)

### A. What it currently says

- Heading: *"Live today. Built for what comes next."*
- Sub: FLITRR is a platform launching with one module and rolling out
  the rest.
- **Live card:** *"✓ Available in pilot — Action Tracking"*, with five
  bullets (portfolio-wide visibility, AI tagging, critical milestone
  flags, multi-party assignment, comment threads).
- **Coming Soon (3 cards):** Risk Register, Portfolio Dashboard,
  Programme Tracker.

### B. What's wrong with it

- **Critical falsehood:** the page says Action Tracking is live in
  pilot. Per the new strategy, **nothing is live**. This must change
  immediately — leaving it as-is would mean shipping a public claim
  the product cannot honour.
- **Wrong flagship:** Action Tracking is presented as the live
  centrepiece. The flagship is **Project Brief**, being built first
  (Milestone 2).
- **Missing module:** Project Brief is not in the list at all.
- **Wrong wrapper:** "Live today / coming soon" framing should become
  "the four modules of PULSE" with honest build-status indicators —
  *In build* / *Designed* / *Planned* — not "Live."
- The section also presents the modules as belonging to "FLITRR";
  they should be presented as belonging to **PULSE**.

### C. What it should say

- **Heading:** *PULSE: four modules, one discipline.*
- **Sub:** *PULSE is being built one module at a time. Each module
  shares the same glass/rubber spine — so what you classify in the
  Project Brief drives what gets flagged everywhere else.*
- **Module cards (4 cards, each with a status pill):**
  1. **Project Brief** — *In build · Pilot Q3*
     *Guided elicitation that produces the formal Project Brief
     document — vision, objectives, glass/rubber criticality,
     constraints, stakeholders. Exportable to PDF and Word.*
     *"The discipline to start right."*
  2. **Action Tracker** — *Designed · Build follows Project Brief*
     *Every open action across every project, classified against the
     glass-ball objectives from your brief. Flagged when the action
     threatens a glass.*
  3. **Risk Register** — *Designed · Build to follow*
     *Structured risk capture tagged to glass-ball objectives.
     Mitigation tracked alongside the actions that close it.*
  4. **Programme Tracker** — *Designed · Build to follow*
     *Critical-path visibility with dependencies, float, and schedule
     impact — the institutional scheduler, finally built for
     developers without a PMO.*
  *(Optionally a fifth card: **Portfolio Dashboard — Planned**, the
  cross-project roll-up.)*

### D. Visual assets needed

- Background: Foreground `#F2F0F4`.
- Cards: Foreground fill, Accent 3 border, Accent 1 module name,
  Accent 2 description text, Accent 1-on-amber status pill for the
  active "In build" card and Accent 3 muted pill for the others.
- F mark watermark in Accent 3 in upper-right of each card to
  reinforce the PULSE-by-Flitrr lineage.

---

## Section 7 — The Pilot

### A. What it currently says

- Heading: *"Join the founding pilot cohort."*
- Three blocks: **What it is** (10 SME developers, 90 days free,
  weekly feedback with founder, roadmap influence) / **What you give**
  (honest use, honest feedback) / **What you get** (lifetime
  founding-member pricing, priority access, direct line).
- Pilot form: email + company name + Request access button.
  Footnote: *"No payment required. No commitment beyond the pilot.
  Ten spots total."*

### A. *(The structural shape of this section is fine. Most of the
revision is copy alignment, not redesign.)*

### B. What's wrong with it

- "90 days of free access to FLITRR" implies access to a live product.
  PULSE Project Brief is not yet live; the pilot offer needs to be
  reframed honestly — **early access to the Project Brief module the
  moment it's ready, plus design-partner input now**.
- "FLITRR" should become "PULSE" everywhere in this section — the
  pilot is for the product, not the brand.
- "Weekly feedback sessions with the founder" is fine but should be
  attributed to the PULSE design-partner programme.
- The form is generic — could ask one or two qualifying questions
  (portfolio size, geography UK/Nigeria) to filter for genuine fit.

### C. What it should say

- **Heading:** *Be a PULSE design partner.*
- **Sub:** *Ten SME developers. Direct input into the product before
  it launches. First access to the Project Brief module the moment
  it's ready.*
- **Three blocks:**
  - **What it is** — *A 90-day design-partner programme. Weekly working
    sessions with the founder while we build the Project Brief module.
    First access on release. Direct say in what gets built next.*
  - **What you give** — *Two real projects, two hours a week, and
    honest feedback. A willingness to shape a product before it's
    finished.*
  - **What you get** — *Lifetime founding-member pricing on PULSE.
    Priority access to every module as it ships. A direct line to the
    team building the tool.*
- **Form (kept simple):** email · company · *portfolio size* dropdown
  (1 project / 2–3 / 4+) · *primary market* (UK / Nigeria / Both) ·
  Request access.
- **Footnote:** *No payment. No commitment beyond the design-partner
  programme. Ten spots total.*

### D. Visual assets needed

- Background: Background amber `#F4C031` (anchors the section as a
  conversion moment).
- Form card: Foreground fill, Accent 1 button, Accent 3 borders.
- F mark in Accent 1 at the top of the form card.

---

## Section 8 — FAQ

### A. What it currently says

Five Q&A pairs:
1. How is this different from Asana / Monday / ClickUp?
2. My consultants and contractors won't adopt a new tool — what then?
3. What's live today, what's coming later?
4. What happens after the 90-day pilot?
5. Do I need IT support to set this up?

### B. What's wrong with it

- Q1, Q2, Q5 broadly survive but reference "FLITRR" → must become
  "PULSE."
- Q3's answer claims **Action Tracking is live for pilot users
  today** — directly contradicts the new strategy. Must be rewritten.
- Q4 references the 90-day pilot of "FLITRR" — must become PULSE
  design-partner programme.
- Missing FAQs the new positioning will provoke:
  - *What is the Project Brief, exactly?*
  - *How is this different from a £50K T&T engagement?*
  - *What is glass-ball / rubber-ball?*
  - *What's the relationship between Flitrr and PULSE?*

### C. What it should say

Recommended six-question set (rewritten where existing, added where
new):

1. **What is Flitrr, and what is PULSE?**
   *Flitrr is the company. PULSE is our first product — a programme
   delivery platform for SME real estate developers. PULSE is built in
   modules; the first to ship is the Project Brief.*
2. **What is the Project Brief, exactly?**
   *A formal document setting out a project's vision, objectives,
   criticality (glass-ball vs rubber-ball), constraints, stakeholders,
   and success criteria. It's the document a senior consultant would
   produce in a six-week engagement. PULSE walks you through the
   elicitation and exports the brief in 15 minutes.*
3. **What's glass-ball vs rubber-ball?**
   *A two-bucket classification of every objective on your project.
   Glass-ball objectives shatter when dropped — completion date,
   planning consent, GIA. Rubber-ball objectives bounce — supplier
   choice, fit-out scheduling, finish spec. PULSE uses your
   classification to decide what gets flagged, escalated, or quietly
   tracked.*
4. **How is PULSE different from Asana, Monday, or ClickUp?**
   *Generic PM tools are built for generic teams. PULSE is built around
   real-estate programme discipline — every objective classified,
   every action tagged to the brief that authorised it, every flag
   tied to something the project literally cannot afford to lose. That
   framing doesn't exist in general-purpose tools.*
5. **My consultants won't adopt a new tool. Then what?**
   *PULSE Project Brief doesn't ask your consultants to adopt
   anything — you produce the brief, you share the PDF, they read it
   like any other document. Later modules (Action Tracker, Risk
   Register) ask invited users for the lightest possible action: log,
   close, comment. No training. If using PULSE is harder than sending
   a WhatsApp message, we've failed.*
6. **What's live today, and what's coming?**
   *Nothing is live yet. The Project Brief module is in active build
   and ships first to design partners. Action Tracker, Risk Register,
   and Programme Tracker follow on the roadmap. Design partners get
   first access to each module as it ships.*

### D. Visual assets needed

- Background: Foreground `#F2F0F4`.
- Accordion chevron in Accent 1.
- Accent 3 dividers between items.

---

## Section 9 — Footer CTA

### A. What it currently says

- Heading: *"Ten spots. First come, first served."*
- Body: *"The founding pilot cohort will shape how FLITRR grows. If
  that's the seat you want, take it now."*
- Button: **Request pilot access** (white pill on dark teal section).

### B. What's wrong with it

- "FLITRR" → "PULSE."
- Dark teal section uses `#0d5a3d` (legacy palette). New equivalent
  is Accent 1 `#37653D`.
- "Founding pilot cohort" → "PULSE design-partner cohort" for
  consistency with Section 7 rewrite.

### C. What it should say

- **Heading:** *Ten design-partner spots. First come, first served.*
- **Body:** *PULSE will be shaped by the developers who use it first.
  If that's the seat you want, take it now.*
- **Button:** *Request a design-partner spot* → `#pilot`.

### D. Visual assets needed

- Background: Accent 1 `#37653D` (deep green) full-bleed band.
- Button: Background amber `#F4C031` fill, Accent 1 text — the only
  place on the page where amber appears as a CTA. This pulls the
  hero brand colour through to the closing moment.
- F mark in Foreground `#F2F0F4` at low opacity as a watermark behind
  the heading.

---

## Section 10 — Footer

### A. What it currently says

- Wordmark: "FLITRR"
- Tagline: *"Programme delivery for real estate developers."*
- Links: hello@flitrr.com · LinkedIn
- Copy: "© 2026 FLITRR. All rights reserved."

### B. What's wrong with it

- "FLITRR" wordmark must become the proper Flitrr wordmark SVG.
- Tagline at the footer should be the **brand-level tagline**:
  *Monitoring What Matters* — not a description of PULSE.
- Footer should clarify the **brand → product** relationship for any
  visitor who skipped the rest of the page.
- "© 2026 FLITRR. All rights reserved." → "© 2026 Flitrr. All rights
  reserved."

### C. What it should say

- **Brand block (left):**
  - Flitrr wordmark SVG (Accent 1 on Foreground, or Foreground on
    Accent 1 if the footer is on dark Accent 1).
  - Tagline: *Monitoring What Matters.*
  - Sub-tagline: *Flitrr is the company behind PULSE.*
- **Links (right):**
  - hello@flitrr.com
  - LinkedIn
  - (Future) Privacy · Terms
- **Copy:** *© 2026 Flitrr Ltd. All rights reserved.*

### D. Visual assets needed

- Background: Accent 1 `#37653D` (continues from Footer CTA) **or**
  Foreground `#F2F0F4` (if a colour break is preferred between
  Footer CTA and Footer).
- Flitrr wordmark in Foreground (if dark bg) or Accent 1 (if light
  bg).
- F mark in matching colour as a brand bug.

---

## Cross-cutting recommendations

### Sections to ADD

1. **Brand → product clarification** (suggested as a thin band
   immediately under the Hero, before the Pain section, OR folded
   into the Hero subheadline).
   *"Flitrr builds programme delivery tools. PULSE is our first
   product. The Project Brief is its first module."*
   This is the single sentence that disambiguates the entire
   information architecture for a first-time visitor.

2. **Project Brief deep-dive section** (between Section 5 *How It
   Works* and Section 6 *What You Get* — or replacing one of the
   weaker sections).
   This section gives the flagship module the screen real estate it
   deserves: a side-by-side of the elicitation flow (left) and a
   sample of the exported Brief document (right), with the locked
   module tagline *"The discipline to start right."* as the heading.
   Without this, the Project Brief is mentioned but never *shown*.

### Sections to REMOVE

- **Hero "dashboard mock"** sub-component (HeroVisual / MockProject /
  the invented project names) — replace entirely with the Project
  Brief document mock described in Section 2C.
- The **Iron Triangle quadrant** in Section 4 — replace with the
  glass-ball / rubber-ball comparison.
- No full sections need to be deleted; all 10 survive in shape, but
  Sections 2, 4, 5, 6, and 8 require **content replacement**, not
  edits.

### Inconsistencies / contradictions in the current page

1. **"Programme delivery platform" vs "Action Tracking module live."**
   Currently the page says FLITRR is a platform (Section 2, 4) **and**
   that Action Tracking is the only live module (Section 6, 8). New
   strategy says nothing is live and the platform name is PULSE.
2. **AI as headline vs AI as mechanism.** The eyebrow says
   "AI-Assisted" but no section explains what the AI does. In the
   rewrite, AI's role is the elicitation flow + objective tagging —
   keep the mention, but anchor it to the Project Brief.
3. **"Critical milestones" without "glass-ball / rubber-ball."**
   Currently Sections 5 and 6 lean on "critical milestones" as the
   filter. The new framing replaces this with glass/rubber objectives,
   which is broader and is the genuine PULSE signature.
4. **Email and footer say "FLITRR" (all caps) but the brand is
   "Flitrr"** (sentence case, double-r). Casing must be corrected
   site-wide.
5. **CSS variables in `globals.css` define `--accent: #0d5a3d` and
   `--accent-dark: #10b981`** — both legacy. The variable names can
   stay; the values must move to the locked palette
   (`--accent-1: #37653D`, `--accent-2: #7793A8`,
   `--accent-3: #B5BCCA`, `--bg-amber: #F4C031`,
   `--bg-foreground: #F2F0F4`).

---

## Open Questions for Olu

1. **Accent 1 hex vs visual swatch.** The brand brief lists Accent 1
   as `#37653D` but describes it as "deep navy/green." `#37653D` is
   unambiguously a forest green. Confirm: is the **hex** canonical
   (use green) or is the **visual swatch** canonical (in which case
   please supply the corrected hex — likely something in the
   `#1a2a4a` family for navy)?

2. **Typography.** The brand assets folder
   (`OneDrive/Documents/FLITRR-Brand Assets/`) contains logo files,
   presentations, mockups, and social templates — but **no standalone
   brand-guidelines PDF**. Confirm whether typography is specified
   inside one of the `.pptx` templates (and which one), or whether it
   is yet to be decided. If undecided, recommend: keep **Plus Jakarta
   Sans** for body / UI text and switch the serif (currently Playfair
   Display) to a quieter, more institutional serif such as **Source
   Serif 4** or **Spectral** to match the consultancy-grade tone.

3. **Project Brief release date.** The pilot copy currently says
   "90 days of free access." Under the new strategy that becomes "90-day
   design-partner programme leading to first access of the Project
   Brief module." Confirm the **target release window** for the
   Project Brief module so the copy can name a credible date
   (e.g. "Pilot Q3 2026," "Beta access by August"). Without a date,
   the copy will read *"first access on release."*

4. **Glass/rubber visual.** No glass-sphere or rubber-ball icon
   exists in the brand pack. Confirm: should I commission these from
   the same designer who built the F mark, or should I draw them
   in-house in SVG to match the geometric F-mark style?

5. **Map-pin sweep.** Confirm there are no other surfaces (favicon,
   open-graph image, LinkedIn header, email signatures) currently
   carrying the retired map-pin icon that need to be replaced
   alongside the landing-page rewrite. The current site has no
   favicon or OG image set, so this is more about other channels than
   the page itself.

6. **Pilot vs design-partner naming.** The current page says "pilot
   cohort." This rewrite suggests "design-partner programme" because
   it's more honest about the pre-launch reality. Confirm preferred
   nomenclature — *pilot*, *design partner*, or both used
   contextually.

7. **PULSE acronym.** PULSE is rendered in all caps as a brand
   convention but no expansion has been provided. Confirm: is PULSE an
   acronym (and if so, what does it stand for), or is it stylised as
   all caps purely for brand emphasis? This affects whether the page
   should ever spell it out on first reference.

8. **Project Brief module deep-dive — section or no?** Recommendation
   is to add a dedicated module section (see "Sections to ADD" above).
   Confirm whether to add it in Task 2, or hold the rewrite to the
   existing 10-section structure.
