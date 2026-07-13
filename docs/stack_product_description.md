# STACK Product Description

Companion to the Flitrr Product Overview. This describes STACK specifically: what it is, the problem it solves, what it does, and how it is structured. For the wider suite, the shared platform, and the full methodology, see the Flitrr Product Overview and the framework document.

---

## 1. What STACK is

STACK is the Flitrr product for feasibility and funding. It sits upstream of delivery, before a developer commits to a scheme. It is in build: its first feature is designed and its engine verified, and the product is not yet live. Where PULSE runs a project once the decision to proceed has been made, STACK is what produces that decision and the funding basis behind it.

STACK brings the appraisal and funding modelling that large developers get from in-house teams and specialist tools to independent and SME developers, in software, and guided for someone with only basic financial knowledge.

---

## 2. The problem it solves

Before committing money to a scheme, a developer has to answer two questions: does this stack up, and how do I fund it. Large developers answer them with appraisal teams, cost consultants, and specialist viability tools. Independent and SME developers usually guess, pay for a one-off appraisal, or work in a spreadsheet they do not fully trust and cannot easily test. STACK gives them a guided, deterministic appraisal and funding model directly, so the go or no-go and the funding route are worked out properly rather than hoped for.

---

## 3. What STACK does

STACK does two things, deterministically.

**Appraise.** It weighs the scheme's development value against its costs and returns the numbers that decide whether to proceed: profit on cost, the residual land value (the most a developer can pay for the land and still hit the target), and a plain go or no-go read against the developer's target hurdle.

**Fund.** It structures the money. The developer picks a funding strategy and STACK sizes the sources, runs the cashflow, and returns the developer's own return under that route, then compares the routes side by side so the funding decision is made on evidence.

Two things define how STACK computes, and they are the product's edge. It is **deterministic**: every output is a pure function of the inputs, no number is invented, and the model reconciles exactly. And it is **traceable**: each assumption carries its basis, so a developer, a lender, or a partner can see where every figure comes from. This is what separates STACK from a generic calculator, and from a generative tool that will produce a confident number it cannot stand behind.

---

## 4. The first feature

The first STACK feature is a development appraisal and funding model. A developer with only basic financial knowledge selects a funding strategy and enters the scheme, and the tool returns an appraisal summary with a plain-English verdict, a cashflow, and a side-by-side comparison of funding routes. Its logic is settled and verified as an engine, and it is being built as the first STACK web feature. It is standalone for now, and will later attach to the shared project spine.

Funding strategy is the spine, and it drives both what else the developer is asked and how the result is computed:

- **Self-funded.** All the developer's own money.
- **Debt-financed.** Borrow against the scheme, as a senior loan only or a senior loan with a mezzanine top-up.
- **Joint venture.** Bring in a partner who contributes cash, land, or both, with a preferred return and a sponsor promote, and the land-for-equity option where the landowner contributes the land at its agreed value and shares in the profit.
- **Off-plan.** Pre-sales fund the build.

The inputs are guided, with forced selection where possible and plain guidance and examples on each field, and a project commencement date that drives a cashflow laid out by phase down the side and calendar month across the top. Sources a route does not use fall to zero, and the joint venture waterfall collapses to all profit to the developer when there is no partner.

---

## 5. On the horizon

These are design direction, not yet built, and must not be presented as available:

- **Objective-awareness.** STACK does not classify a project's objectives; that is PULSE's job. But by reading the classified objectives it can point the appraisal at the levers still in play. STACK is objective-aware, not objective-owning.
- **Traceability in full.** Every assumption already carries a basis note as the first move; the complete provenance, confidence, and citation model comes with the engine layer.
- **The PULSE handoff.** The feasibility and funding output expressed in the terms PULSE locks at Stage 1: hard cost, soft cost, contingency, funding structure, and funding milestones.
- **One STACK model.** Folding the appraisal and the funding engines into a single model.
- **Scope still to confirm.** Whether earlier-scoped feasibility and cost-estimation capabilities fold into STACK or remain separate.

---

## 6. How STACK is structured

**Engine first, three registers.** STACK is built to the same three-register pattern as PULSE: a front register the user sees, an engine register holding the deterministic logic, and a back register for the data. The engine is built and proven first, and it runs server-side, never shipped to the browser, which is what keeps the valuable modelling on the platform.

**The shared project spine.** STACK produces the feasibility and funding basis that the platform-level project spine carries and that PULSE locks into the baseline at Stage 1. The first feature is standalone for now; the attachment to the shared record comes as the products align.

**Where STACK sits.** STACK is one of three products on the shared platform: STACK upstream for feasibility and funding (in build), PULSE for delivery and governance (shipped), and ROUTE for procurement strategy (a concept). The longer-horizon Orchestrator will sequence them through the lifecycle; the products are proven first, not built around it.

---

## 7. Geography

STACK's core is geography-agnostic and its expression is configurable. In the United Kingdom the appraisal reflects UK cost bases, SDLT, and planning obligations such as Section 106 and the Community Infrastructure Levy. In Nigeria the funding modelling leads, because off-plan pre-sales frequently fund the build directly, and the model supports reporting in the relevant currency.

---

## 8. Conventions

STACK follows the Flitrr build conventions in full: problem-first, design before build, deterministic over generative, and verify before commit. The stack is Next.js 14 App Router, JavaScript, CSS Modules, Supabase, and Vercel, with Vitest for tests. The house rules apply to every deliverable: UK spelling, no em dashes or en dashes, exact casing of Flitrr, PULSE, ROUTE, STACK, and never implying an unbuilt feature is available. The full set is in the Flitrr Product Overview.

---

*Product description, held in the repo alongside the Flitrr Product Overview and the framework document. STACK is in build; the first feature's logic is settled and verified, and anything on the horizon is marked as not yet built.*
