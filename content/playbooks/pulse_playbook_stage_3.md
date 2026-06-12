# PULSE Playbook, Stage 3: Design and Planning Approvals

**Status: agreed v2, confirmed by Olu 2026-06-11. This is the Stage 3 seed content for the M7.4 engine. Nine action plays, four risk plays.**
All plays jurisdiction-neutral (general), per the v1 rule.

Stage 3 plays carry a developer from a passed Gate 2 to a passable Gate 3 to 4, whose tests are: planning and regulatory approvals secured, the design frozen to a procurement-ready level, the cost plan updated, and the approved design still meeting the non-negotiable objectives.

Changes in v2: value-engineer play reworded per Olu's redline, the classification discipline plus the delivered-outcome test on protected objectives. Conditions play kept separate from pre-application against the redline, with rationale: they are bookend moments months apart, the legal exposure of a missed discharge is severe, and a merged play becomes a compound action that can never be cleanly marked done. Design-freeze play reworded rather than deleted, counter-proposal: the objection (not every change has a price impact) corrected the wording, while the discipline itself is framework principle 4, changes explicit and re-approved, never by drift.

UK-specific candidates held by name for the later UK market pack: CIL commencement notice, party wall, rights of light.

---

## Action plays

```
play: survey-before-design
type: action
stage: 3
jurisdiction: general
title: Commission the surveys the design depends on, before the design depends on them
why: A design drawn on assumed ground, hidden services, or an unmeasured site is a design that will be redrawn at your cost, and the ground is where most overruns are born.
objective: cost
always_critical: no
```

```
play: stage-design-reviews
type: action
stage: 3
jurisdiction: general
title: Review the design against the Brief and the cost plan at the end of every design stage
why: Every line a designer draws commits your money, and a cost plan updated only at the end discovers the overrun after everyone has fallen in love with the design.
objective: cost
always_critical: no
```

```
play: design-spend-sequencing
type: action
stage: 3
jurisdiction: general
title: Hold detailed design spend until the planning risk is retired
why: Every drawing produced before permission is a bet that permission comes, so spend to the level the approval risk justifies and no further, unless time genuinely demands the gamble.
objective: cost
always_critical: no
```

```
play: pre-application-engagement
type: action
stage: 3
jurisdiction: general
title: Engage the approving authority before you formally apply
why: An objection you hear in a pre-application meeting costs you a revised drawing, while the same objection in a refusal costs you months and a fresh application.
objective: time
always_critical: no
```

```
play: conditions-before-celebration
type: action
stage: 3
jurisdiction: general
title: Read, cost, and programme every condition attached to your permission
why: Permission is not the green light; the conditions are, and the ones that must be discharged before you start can take weeks each, so treat them as a workstream from the day the decision lands.
objective: time
always_critical: no
```

```
play: approvals-beyond-planning
type: action
stage: 3
jurisdiction: general
title: List every approval and connection the build needs, and start the long-lead ones now
why: Planning is rarely the only permission, and utility connections and statutory agreements have lead times measured in months, so the programme is set by the slowest approval you have not started.
objective: time
always_critical: no
```

```
play: coordinated-buildable-freeze
type: action
stage: 3
jurisdiction: general
title: Demand a coordinated, buildable design before you freeze it
why: Clashes between structure, services, and architecture that are cheap to fix on a drawing are ruinous to fix on site, and an uncoordinated freeze just books that cost for later.
objective: quality
always_critical: no
```

```
play: value-engineer-by-classification
type: action
stage: 3
jurisdiction: general
title: Value engineer against flexible objectives, and test every cut against the protected ones
why: When the cost plan drifts the savings come from what you classified as able to flex, but every cut must be tested for its knock-on, because a saving that quietly degrades a protected objective only surfaces as failure once the project is delivered.
objective: cost
always_critical: no
```

```
play: design-freeze-discipline
type: action
stage: 3
jurisdiction: general
title: Freeze the design, then change it only by deliberate decision
why: Some changes are genuinely free, but the expensive ones never announce themselves, so after freeze every change is checked for its cost and time effect before it is agreed, never discovered after it is built.
objective: cost
always_critical: no
```

---

## Risk plays

```
play: design-cost-drift
type: risk
stage: 3
jurisdiction: general
title: The developing design quietly outgrowing the cost plan
why: Design development adds cost in small, reasonable increments, and without a cost check at each stage the overrun is discovered at tender, when the choices left are all bad ones.
objective: cost
always_critical: no
```

```
play: planning-outcome-risk
type: risk
stage: 3
jurisdiction: general
title: A planning decision later or worse than the programme assumes
why: Approval timelines are not in your control, and a programme built on the best case turns a routine delay into a funding and contract problem.
objective: time
always_critical: no
```

```
play: ground-conditions-surprise
type: risk
stage: 3
jurisdiction: general
title: Ground conditions or site constraints the surveys have not derisked
why: What is under the site is the most expensive unknown in development, and it does not negotiate.
objective: cost
always_critical: no
```

```
play: utility-leadtime-risk
type: risk
stage: 3
jurisdiction: general
title: Utility connections whose lead times outrun the programme
why: A finished building that cannot be powered or drained is not finished, and connection queues do not care about your completion date.
objective: time
always_critical: no
```
