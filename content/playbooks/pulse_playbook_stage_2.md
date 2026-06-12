# PULSE Playbook, Stage 2: Consultant Appointment

**Status: agreed v2, confirmed by Olu 2026-06-11. This is the Stage 2 seed content for the M7.4 engine. Ten action plays, four risk plays.**
All plays jurisdiction-neutral (general), per the v1 rule.

Stage 2 plays carry a developer from a passed Gate 1 to a passable Gate 2 to 3, whose tests are: the required consultants appointed and scoped against the Brief, fees confirmed, the team capable of delivering the non-negotiable objectives, and fees within the cost objective's tolerance.

Changes in v2: former Actions 2 and 3 merged into one scope-and-fees play (Olu's redline); Action 8 reshaped as the design team responsibility matrix (Olu's redline); key-person dependency risk cut as a register entry (Olu's redline) with its protection folded into the capability action; statutory duty holders play added from the research pass, the second always-critical play. Parked candidate, by name: novation-readiness of appointments for a possible design-and-build route, held to keep the set within its cap.

---

## Action plays

```
play: define-team-needed
type: action
stage: 2
jurisdiction: general
title: Decide which consultants this project actually needs now, and which can wait
why: Over-appointing burns fee budget before the design settles, and under-appointing surfaces later as a refusal or a redesign, so the team list is a decision, not a default.
objective: cost
always_critical: no
```

```
play: scope-and-fees-against-brief
type: action
stage: 2
jurisdiction: general
title: Check every scope of services and fee against the Brief before signing
why: A consultant scoped from their standard template will deliver their standard service, and a fee without an agreed basis becomes a negotiation after the work is done, so both must be pinned to your Brief before anything is signed.
objective: cost
always_critical: no
```

```
play: statutory-duty-holders
type: action
stage: 2
jurisdiction: general
title: Confirm the statutory duty holders for your project and appoint them in writing
why: In many jurisdictions the legal duties for construction health and safety sit with you, the client, by default, and unless you formally appoint competent people to the formal roles, an inspector or an incident will find you holding duties you never knew you had.
objective: quality
always_critical: yes
```

```
play: pi-insurance-check
type: action
stage: 2
jurisdiction: general
title: Confirm professional indemnity insurance for every consultant before appointment
why: If a consultant's design or advice fails years later, their PI insurance is what pays for the fix, so an appointment without verified cover leaves that whole risk sitting on you.
objective: quality
always_critical: yes
```

```
play: written-appointments
type: action
stage: 2
jurisdiction: general
title: Put every appointment in writing before work starts
why: A handshake appointment means the deliverables, the fee, and who owns the drawings are all undefined, and every one of those becomes a dispute precisely when the relationship is under strain.
objective: cost
always_critical: no
```

```
play: capability-against-objectives
type: action
stage: 2
jurisdiction: general
title: Test each consultant's track record against your non-negotiable objectives
why: A team that has never delivered your project type at your scale will learn on your money, and in a small firm the partner who pitched is not always the person who delivers, so test the people you will actually get, not the brochure.
objective: quality
always_critical: no
```

```
play: design-lead-settled
type: action
stage: 2
jurisdiction: general
title: Settle who leads and coordinates the design team
why: When no single consultant owns coordination, every gap between disciplines becomes yours to find, usually on site and at full price.
objective: time
always_critical: no
```

```
play: design-responsibility-matrix
type: action
stage: 2
jurisdiction: general
title: Agree a design team responsibility matrix
why: Projects rarely stall because the work is hard; they stall because nobody agreed whose decision it was, and a one-page matrix set now prevents weeks of drift later.
objective: time
always_critical: no
```

```
play: design-licence-secured
type: action
stage: 2
jurisdiction: general
title: Secure your licence to use the design if an appointment ends
why: If you part ways with a consultant who owns the drawings, you can be forced to pay again for work you already funded, so the right to use the design must sit in the terms from day one.
objective: cost
always_critical: no
```

```
play: funder-reliance-check
type: action
stage: 2
jurisdiction: general
title: Ask your funder what consultant warranties or reliance they will require
why: Funders often need a direct legal route to your consultants, and discovering that after appointments are signed means reopening every contract with no negotiating power.
objective: funding
always_critical: no
```

---

## Risk plays

```
play: scope-of-services-gap
type: risk
stage: 2
jurisdiction: general
title: Gaps or overlaps between consultant scopes of services
why: When two appointments each assume the other covers a duty, the gap surfaces mid-project as a fee claim or a missed deliverable, and it is always cheaper to close on paper now than on site later.
objective: cost
always_critical: no
```

```
play: fee-creep-additional-services
type: risk
stage: 2
jurisdiction: general
title: Fees creeping beyond the cost tolerance through additional services
why: Each extra feels small and justified at the time, and the breach only shows when the totals are added, by which point the work is done and the money is owed.
objective: cost
always_critical: no
```

```
play: relationship-over-capability
type: risk
stage: 2
jurisdiction: general
title: A consultant appointed on relationship rather than capability
why: A familiar face lowers the guard exactly where scrutiny matters most, and the shortfall tends to surface deep in the project where replacement is most disruptive.
objective: quality
always_critical: no
```

```
play: programme-assumption-clash
type: risk
stage: 2
jurisdiction: general
title: Appointment programmes that quietly contradict the Brief's time objective
why: If a consultant's delivery dates do not add up to your completion date, the slip is committed now and merely revealed later.
objective: time
always_critical: no
```
