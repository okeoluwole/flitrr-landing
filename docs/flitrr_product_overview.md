# Flitrr Product Overview

Holistic context for anyone, human or AI, building any part of Flitrr. Read this before building a feature, so the work fits the whole rather than only the task in front of it. It is a companion to any feature-specific brief.

---

## 1. What Flitrr is

Flitrr is a property development lifecycle software suite for independent and SME developers in the United Kingdom and Nigeria. These developers run real projects but cannot afford the project office, cost consultants, and delivery discipline that large developers buy from consultancies. Flitrr gives them that discipline directly, in software.

Flitrr is the successor to an earlier venture, PROPELLR, which failed from technology-first thinking: it built orchestration infrastructure before validating the underlying products anyone would pay for. Flitrr is deliberately the opposite. It is problem-first. Every feature is grounded in a specific developer problem, tightly scoped, and designed in full before any code is written.

---

## 2. The product suite

Flitrr is three products on one shared platform. Each expresses part of the same methodology (Section 4) and attaches to the same project record (Section 3).

**PULSE (built and shipped).** Project delivery and programme governance. PULSE runs a project from initiation onward: it sets the project up properly at the start through a guided initiation flow that produces a version-locked Project Brief with classified objectives, it enforces a deliberate decision gate at every stage transition, and it monitors the project in proportion to what matters most. Its capabilities today include project initiation and the Brief, stage gates, risk intelligence, an action log, and a programme and schedule module, with an executive dashboard in progress, all on a multi-tenant organisation model with role-based access.

**STACK (in build; where the current work sits).** Feasibility and funding. STACK sits upstream of delivery. It answers the two questions a developer faces before committing: is this scheme worth doing, and how is it funded. It appraises the scheme (development value against costs, residual land value, profit on cost, a go or no-go read) and structures the funding, deterministically. The first STACK feature is a development appraisal and funding model, described in Section 5.

**ROUTE (early concept, not built).** Procurement strategy. ROUTE builds on the procurement decision: the procurement route plus a scope matrix across consultants and contractors. It follows the same lock-then-open pattern as the rest of the suite: complete and lock a structured output, which then opens the next steps.

A discipline that holds across all three: never imply an unbuilt product or feature is available. PULSE is shipped. STACK is in build. ROUTE is a concept.

---

## 3. The shared platform

The three products are not separate apps bolted together. They share one project record, the project spine, that holds the project's brief, its locked objectives and baseline, and its risk position. Every product reads from and writes to that single record. STACK produces the feasibility and funding basis; PULSE locks it into the baseline at Stage 1; ROUTE reads the same brief for the procurement scope. One project, one source of truth, three lenses.

The longer-horizon north star is an Orchestrator: a deterministic workflow state machine over the shared database that guides a project end to end through the lifecycle, pulling capabilities from all three products inline as each stage needs them. The Orchestrator governs how each product is built, so the products stay composable. It is a direction, not a parallel build. Products are proven first; the Orchestrator sequences them later.

---

## 4. The Flitrr Framework (the methodology)

Everything Flitrr builds honours one methodology, the Flitrr Framework. It was first documented as the PULSE Framework, PULSE being its first full expression, and the detailed specification lives in the framework document held in the repo. In summary:

**Three layers.** The lifecycle stages are the spine, the macro timeline. The initiation flow is how a project is set up at the start and produces the baseline. The principles and the classification discipline cut across every stage and hold the whole together.

**Eight lifecycle stages, 0 to 7.** Stage 0 Land and Site Acquisition; Stage 1 Project Objectives and Funding; Stage 2 Consultant Appointment; Stage 3 Design and Planning Approvals; Stage 4 Contractor Procurement; Stage 5 Construction; Stage 6 Completion and Handover; Stage 7 Sales and Disposal. This is the developer's decision timeline, the Flitrr equivalent of the RIBA Plan of Work but built around the developer's decisions rather than the architect's workflow.

**Six principles (locked).** Staged delivery with gates; objective criticality; cascading classification; locked baseline; proportional monitoring and escalation; tailoring within discipline. Together they mean a project moves through deliberate go or no-go gates, its objectives are classified once at the start by what can flex and what cannot, that classification cascades down to milestones, risks, and workstreams, the baseline is version-locked and only ever changed by explicit re-approval, monitoring intensity scales with criticality, and the method adapts to project type and geography without ever flexing away its core.

**Five classified objectives.** Scope, cost, time, quality, and funding. The first four are the classic project constraints; funding is added as a fifth because at SME scale funding availability is existential and frequently the binding constraint. At initiation each objective is classified non-negotiable or flexible, and that classification governs every later decision.

**Gates.** Every stage transition is a gate with two parts: a stage-specific checklist (is the stage's work done) and the objective lens (is this still the project that was committed to). A gate passes only when both are satisfied. A compromise to a non-negotiable objective fails the gate even when the checklist is complete; the project resolves it or formally re-baselines.

**Geography.** The core is geography-agnostic; the labels and conditions are configurable. In the United Kingdom, stages map onto RIBA, RICS, and JCT conventions and UK planning, building regulations, and the Building Safety Act. In Nigeria, sequencing is funding-led because construction often follows funding tranches and off-plan sales fund the build directly, the regulatory environment reflects the Land Use Act and REDAN conventions, and sales frequently run concurrent with construction rather than after it.

---

## 5. Where STACK sits, and the first STACK feature

From Stage 1 onward the framework assumes the go decision has already been made and the funding basis is known. STACK is what produces both. It is the feasibility and funding product upstream of delivery, covering the appraisal and funding work that Stage 1 then locks into the baseline, and it models the funding objective that the framework treats as first-class.

The first STACK feature is a development appraisal and funding model. A developer with only basic financial knowledge selects a funding strategy and enters the scheme, and the tool returns an appraisal summary with a plain-English verdict, a cashflow, and a side-by-side comparison of funding routes. Funding strategy is the spine: self-funded; debt-financed (senior loan only, or senior plus mezzanine); joint venture (partner contributes cash, land, or both, with a preferred return and sponsor promote, and the land-for-equity option); or off-plan (pre-sales fund the build). It is deterministic: every output is a pure function of the inputs, no number is invented, and it reconciles exactly. It is standalone for now, and will later attach to the shared project spine and align with further STACK features as they are agreed.

---

## 6. How Flitrr is built (principles and conventions)

These govern how any Flitrr feature is built, this one included.

**Problem-first.** Every build starts from a specific developer problem, tightly scoped. No infrastructure ahead of a validated product.

**Design before build.** Decisions are settled in conversation first. Code is written only once the design is locked.

**Deterministic over generative.** Where Flitrr computes, it derives. The engine never invents a number or a claim; every output traces to an input and a rule, and reconciliation checks must hold exactly.

**Verify before commit.** A green test suite, then a visual walkthrough and sign-off, before any commit or push. Nothing is committed on assumption.

**Lock-then-open.** The product spine across STACK, ROUTE, and the Orchestrator: complete and lock a structured output, which then opens the next steps.

**Stack.** Next.js 14 App Router, JavaScript (not TypeScript), CSS Modules (no Tailwind), Supabase (project flitrr-app), Vercel (flitrr.com), GitHub, Vitest for tests. Mobile-first.

**House rules on every deliverable.** UK spelling throughout. No em dashes or en dashes anywhere (use commas, or the word to for ranges, and hyphens only inside hyphenated words). Exact casing: Flitrr, PULSE, ROUTE, STACK. Never imply an unbuilt product is available.

---

*This overview is deliberately holistic and stable. Feature-specific detail lives in each feature's own brief, and the full methodology lives in the framework document. Keep all three committed to the repo so any session loads the whole picture.*
