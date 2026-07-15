PULSE Project Dashboard (M9)
Content specification, version 0.3, LOCKED
Reconciled against the M9.0 reconnaissance
________________________________________
0. How to read this
This is a content and logic specification, not a build specification. It fixes what the dashboard says, what it computes, and the deterministic rule behind every state and every line of copy. It does not fix layout, components, or file structure.
Everything here is deterministic. Nothing on this surface is generated. Every state, every colour, and every sentence is a function of data PULSE already holds.
What changed in v0.3
The M9.0 reconnaissance confirmed both load-bearing assumptions and then found five things the spec had not accounted for. All are folded in below.
1.	The two load-bearing questions came back green. Every milestone in a frozen baseline snapshot carries serves. deriveRAG flags per point. Band 2 stands as designed.
2.	Time has two independent tests, not one. The reconnaissance found the fixture project's locked programme completing five months after its own target completion date, with nothing anywhere in PULSE saying so. Section 5 now carries both tests.
3.	Gates carry no objective. They never appear in Band 2. Section 6 gives them their home.
4.	Accepted risks now count toward an objective's state. This corrects an error in v0.1 and v0.2. Section 4 sets out why.
5.	Unlinked risks and actions exist and must never be silently absent. Section 4.
6.	Classification drift between the live objective and the baked baseline must be surfaced, never averaged. Section 8.
________________________________________
1. What the dashboard is
The objective lens, run continuously.
At every gate the framework asks one question: do the classified objectives remain achievable, and has anything in this stage put a non-negotiable objective at risk? Today that question fires once, at a gate. The dashboard asks it every day, from live data.
Four consequences follow, and they govern everything below.
1.	The dashboard is organised by objective, not by module.
2.	It owns no data. No new table, no writes. It is a pure read and compose layer.
3.	It re-derives nothing. Percent, RAG, forecast, severity, criticality, and the risk assessments all come from the engines that already produce them. If a figure on the dashboard disagrees with a figure in a module, the dashboard is wrong by definition.
4.	It routes, it does not act.
________________________________________
2. The join, confirmed
Three different joins, and they are not the same shape.
•	Risks link by row: project_risks.linked_objective_id, UUID, nullable, FK to project_objectives(id).
•	Actions link by row: project_actions.linked_objective_id, UUID, nullable, same shape.
•	Milestones link by type: the frozen snapshot bakes serves as the objective type string, not a row id.
The type-to-row resolution is safe because objectives are one row per type per project, enforced by a unique constraint.
The RAG flag does not carry serves. deriveRAG().flagged[] returns { key, kind, name, criticality, stage, baselineDate, weeksBehind, condition, colour }. To name the objective a slipping milestone serves, join flagged[].key back to the milestone of the same key in the baseline snapshot. Keys are stable. This is a compose-time join, not a re-derivation.
________________________________________
3. The five objectives and their two ladders
Scope, Cost, Time, Quality, Funding. Each classified at initiation as non_negotiable (protected) or flexible.
	Protected objective	Flexible objective
Green	Holding	Holding
Amber	Under pressure	Absorbing
Red	Compromised	Exhausted
Absorbing says the objective is doing its job, taking the strain so the protected ones do not have to.
Exhausted says it has no give left, so the next setback lands on something you protected.
Three states each. Not scored is not a rung on this ladder. It is what a row reports when it has nothing to compute a state from.
________________________________________
4. The evidence
An objective's state derives from three sources, and only these three.
4.1 Risks tagged to it
Status enum: watching, acting, accepted, closed. Open means not closed.
Severity comes from deriveSeverity(likelihood, impact), which returns { key, label } with key in serious | moderate | minor | unscored. The engine rules below use the keys. moderate renders as "Worth watching".
Accepted risks count toward the objective's state. This corrects v0.1 and v0.2.
Accepting a risk does not remove the exposure. It means the developer has decided not to spend money mitigating it. The exposure on the objective is identical either way, and an accepted Serious risk on a protected objective is the most damning thing this surface can show, because it is an incoherent position: you said Cost cannot move, and you have consciously chosen to carry a serious cost risk.
Accepted risks therefore count in Band 2 and do not appear in Band 3. The exposure is real; nothing is being asked of the developer.
Closed risks drop out of everything.
4.2 Actions serving it
Open means status is not done. The status enum is to_do | doing | done.
There is no due date. Confirmed. "Overdue action" is not a derivable signal and no rule depends on one.
Criticality derives live from the linked objective via the kernel. The stored criticality column is a snapshot stamped at creation and is not authoritative. criticality_override is downward only and a stale override falls inert.
4.3 Milestones serving it
From the frozen programme_baselines.programme snapshot, joined to deriveRAG().flagged[] by key.
project_milestones is forbidden. The initiation-era table still exists and looks exactly like what a dashboard would want. It is dead. Read milestones only from the baseline snapshot.
4.4 Unlinked risks and actions
linked_objective_id is nullable on both. An unlinked item belongs to no objective and is therefore absent from Band 2.
That absence must never be silent. An unlinked risk is a failure of the method, not a neutral state. Band 1's caveat names the count. Band 3 flags them through the monitor's existing needsLink.
4.5 The honest limit
Cost, Scope, Quality and Funding have no actuals in PULSE. Their state reads from the risks and actions tagged to them, and from the milestones serving them. That is a real read of real exposure. It is not a measurement of the objective, and this surface never implies that it is.
Time is different, and section 5 sets out why.
________________________________________
5. Time, and the two gaps
Three dates exist.
•	T, the target completion date. projects.target_completion_date. The developer's commitment, set at initiation.
•	B, the baseline completion. The latest baseline date across trackable points in the locked programme.
•	F, the forecast completion. From deriveForecast.
Two independent gaps, and they mean different things and have different remedies.
The planning gap, B minus T. The plan you locked does not reach the promise you made. True from the moment of lock, before a single day slips. The remedy is to re-baseline or to move the target.
The delivery gap, F minus B. The plan is slipping. This is what the Programme surface already reports. The remedy is to chase the schedule.
They sum. F minus T is the total, and the total is what the Time objective is actually about, because the objective is the target.
PULSE reports neither today. The reconnaissance found the fixture project's locked programme completing 1 June 2028 against a target of 31 December 2027, five months adrift, with nothing in the product mentioning it. The Programme surface compares forecast to baseline only.
5.1 The Time rule
Let totalWeeksLate = weeks(F minus T).
Protected Time
•	Compromised if totalWeeksLate is greater than zero. No grace band. Non-negotiable means no tolerance; that is the definition of the word.
•	Under pressure if totalWeeksLate is zero or negative but within toleranceWeeks of the target. You will make it, and you have no room left.
•	Holding otherwise, from the date signal.
Flexible Time
•	Absorbing if totalWeeksLate is greater than zero. Never Exhausted from the date signal alone. The stated tolerance is prose and uncomputable, so PULSE cannot know whether the agreed bound has been passed. It says so rather than guessing.
•	Holding otherwise, from the date signal.
Time's final state is the worst of its date signal and its risk, action and programme signals.
If T is null, the date test does not run and Time reads from risks, actions and milestones like any other objective.
5.2 The Time row's reason decomposes the gap
Because the remedies differ, the reason line must say which gap it is.
Planning gap only:
The programme you locked completes [X] after your target. That was true the day you locked it.
Delivery gap only:
Your forecast completes [X] after your target. The plan was sound; delivery has slipped.
Both:
Your forecast completes [X] after your target. [Y] of that was baked in when you locked the programme, and [Z] has slipped since.
That third line is the agreed-versus-actual reconciliation the framework asks for, running continuously instead of once at a gate.
5.3 Prose tolerance is quoted, never computed
The per-objective tolerance is free text: "2 months project completion versus baseline completion date". It is not computable and no rule uses it.
Where a flexible objective is past its target, the row quotes the stated tolerance and says plainly that PULSE cannot test it. The developer feels the cost of prose, which is the fastest route to fixing it.
________________________________________
6. Gates sit at project level, never in Band 2
The snapshot bakes serves into every milestone. It bakes nothing into gates. Gates are critical by nature and always red when they slip, which makes them the loudest programme signal.
The temptation is to attribute them to Time. Do not. It invents a link the data does not carry, and it is wrong on the merits: a gate slips because of its causes, and its causes are already sitting in the objective rows as milestones. Attributing the gate to Time double-counts and mislabels.
•	Gates never appear in Band 2.
•	A slipping gate lands in fact 4 and sorts above everything in Band 3, because it answers to all five objectives rather than one.
________________________________________
7. The state rules
Per objective, from the evidence:
•	worstRisk: the highest open severity key among risks tagged to it. One of none, minor, moderate, serious.
•	seriousCount: the number of open Serious risks tagged to it.
•	acceptedSerious: how many of those are accepted.
•	openCritical: the number of open critical actions serving it, criticality derived live.
•	programmeFlag: the worst colour among flagged milestones serving it. One of none, amber, red. Gates excluded.
Protected objective
•	Compromised if worstRisk is serious, OR programmeFlag is red, OR (Time) the date rule says compromised.
•	Under pressure if worstRisk is moderate, OR openCritical is one or more, OR programmeFlag is amber, OR (Time) the date rule says under pressure.
•	Holding otherwise.
Flexible objective
•	Exhausted if seriousCount is two or more, OR programmeFlag is red.
•	Absorbing if worstRisk is serious or moderate, OR programmeFlag is amber, OR (Time) the date rule says absorbing.
•	Holding otherwise.
Not scored
An objective reports Not scored when it has no scored evidence at all: no scored risk tagged to it, no open action serving it, and no milestone serving it in a locked baseline.
Not a rung on the ladder. Renders neutral, never green, and carries the one tap that fixes it.
Why this exists, stated once so it is never quietly removed. Green must mean we looked and found nothing. It must never mean nothing was entered. The wizard seeds starter risks unscored, so a ladder with no off-ladder condition would paint five rows green on day one and tell a developer his project is healthy on the basis of zero assessed information. PULSE already agrees one layer down: not-yet-engaged is one of the monitor's four triggers, and unscored is already a severity key.
Two consistency checks that prove the model holds
•	openCritical cannot appear on a flexible objective. Criticality cascades from the objective and the override is downward only, so an action serving a flexible objective is standard by definition. The model is self-consistent with the kernel that already exists.
•	A flexible objective needs two Serious risks to reach its top state where a protected objective needs one. That gap is the single place where proportional monitoring becomes a number.
________________________________________
8. Classification drift, and it must never be averaged
Risks and actions derive criticality live from the objective's current classification. The programme baseline bakes criticality at lock.
Reclassify an objective after the baseline is locked and the two regimes disagree. The same objective reads critical on its risk column and standard on its milestones. This is locked, correct behaviour under the re-baseline rule, and today it is completely invisible.
The dashboard detects it and says so on the row.
Cost is protected, but your locked programme still monitors it as standard. Re-baseline to bring them into line.
The dashboard reports each figure in the regime that produced it. It never re-derives the baked value and it never averages across the two.
Detection: compare the objective's live criticality, derived from classification, against the baked criticality on the milestones serving it in the snapshot. Any disagreement raises the notice.
________________________________________
9. The project state
Computed from the scored protected objectives only.
•	Red if any scored protected objective is Compromised.
•	Amber if any scored protected objective is Under pressure, OR any scored flexible objective is Exhausted.
•	Green if every scored protected objective is Holding, and at least one protected objective is scored.
•	No state if no protected objective is scored at all.
An unscored protected objective pushes the project neither green nor red. It fires the caveat, which names it.
Blindness is reported, never coloured.
The load-bearing behaviour
A flexible objective that is merely Absorbing does not move the project off green. That is the classification doing its job, and it is the single most important behaviour on this surface. A developer who protected all five objectives will find their project goes red at the first Serious risk anywhere, which is the framework telling the truth about over-constraint every day rather than once at a gate.
________________________________________
10. Band 1: The read
A colour, a state sentence, up to two supporting lines, four facts.
10.1 The state sentence
One sentence. First matching rule wins.
Rule 0. No protected objective is scored.
Nothing is scored yet, so there is no read to give. Score your risks to open it.
Rule 1. One or more protected objectives Compromised.
Cost is compromised. You protected it, and [reason].
Two of your protected objectives are compromised: Cost and Time.
The [reason] slot takes the first trigger that fired:
•	a Serious risk is live against it
•	a Serious risk is live against it, and you have accepted it
•	a milestone serving it has slipped past your tolerance
•	the programme you locked already completes after your target
•	your forecast completion is [N] weeks past your target
Rule 2. One or more protected objectives Under pressure.
Cost is under pressure. It is the only protected objective currently exposed.
Two of your three protected objectives are under pressure: Cost and Time.
Rule 3. All scored protected objectives Holding, one or more flexible objectives Exhausted.
Cost has absorbed as much as it can. Your next setback lands on something you protected.
Rule 4. All scored protected objectives Holding, one or more flexible objectives Absorbing.
Every protected objective is holding. Cost and Scope are absorbing the pressure, which is what you classified them to do.
Rule 5. Everything Holding.
Every objective is holding.
10.2 The supporting lines
At most two, in this priority order.
1.	Over-constraint, if it applies. This is pulseRead Rule 1, already built. Surface it unchanged.
2.	The blind-spot caveat, one line, highest-priority condition wins:
o	a. Unlinked items: 3 risks and 1 action are not linked to an objective, so they sit outside this read.
o	b. Unscored risks: 6 of your 9 risks are unscored, so this read is incomplete. Name any protected objective that is Not scored.
o	c. No baseline: No programme baseline is locked, so schedule pressure is not in this read.
3.	The concentration read, if it fires. This is pulseRead Rule 2, already built.
10.3 The four facts
1.	Stage. Stage 2, Consultant Appointment.
2.	Complete. From deriveProgress.
3.	Forecast completion, against target. The forecast date, and the variance in weeks against projects.target_completion_date. Name both dates on the tile.
4.	Next gate. Its name, its baseline date, and the open actions bearing on it. gateReadiness(actions, byId, currentStage) already returns { open, critical }. Use it. No pass or fail claim.
Gate 2 to 3, 12 September. 3 open actions bear on it, 2 critical.
10.4 Fact 3 and the Programme surface will differ, and that is correct
The Programme surface reports forecast against baseline. It is asking whether the plan is being delivered.
The dashboard reports forecast against target. It is asking whether the commitment will be met.
Both are true. They answer different questions, and each surface compares against its own commitment. Naming both dates on the tile is what stops it reading as a contradiction.
The dashboard does not reuse forecastCompletionTile, which is hard-wired to the baseline comparison. It performs its own comparison against the target. That is a new comparison, not a re-derivation, and it does not breach the no-re-derivation guardrail.
10.5 No programme RAG tile
Band 1 already carries the project colour and two colours compete for the same three seconds. The schedule signal is distributed into the objective rows, where it means something.
________________________________________
11. Band 2: Objective health
This band is the product. The only place in PULSE where the project is seen through the objectives rather than through the modules.
Five rows. Protected block first, flexible second. Within each block, worst state first, Not scored rows beneath the scored ones. Protected rows carry full visual weight, flexible rows are quieter. Proportional monitoring rendered in typography.
Row anatomy
•	The objective name.
•	The classification chip.
•	The state with its colour, or Not scored in neutral.
•	The reason, in plain words. Not an inventory.
•	The classification drift notice, where it applies.
Not this:
2 risks, 3 actions, 1 milestone.
This:
A Serious risk is live on Cost, and a milestone serving it is slipping by three weeks.
Not scored:
Nothing scored against Cost yet.
With a one-tap route to the Risk register. A Not scored row is never a dead end.
The expansion
On tap, the row expands in place to list every item tagged to that objective across all three modules: the risks, the open actions, the milestones serving it. Each item deep-links to its home module.
This expansion is the reason to build the dashboard. "Show me everything threatening Cost" is a question a developer asks constantly and that PULSE cannot answer today.
________________________________________
12. Band 3: What needs you now
One unified attention list, capped at five rows, with a See all N in [module] link beneath.
Sources
•	The Risk monitor's flagged assessments. assessRisks is already documented as the shared ordering for the Programme and the Dashboard. Use it as given.
•	The Action Log's open critical actions and its live needs-response items.
•	The Programme's flagged slipping items, from deriveRAG().flagged[].
Exclusions
•	Accepted risks do not appear here unless the monitor flags them. The developer has already decided.
•	Closed risks and done actions never appear.
Dedupe, and it is not optional
One row per underlying thing. A Serious risk with an open promoted action is one item, not two. Show the action, name the risk on the row. This is the rule already built in M7.2. Reuse it.
Order
1.	A slipping gate sorts above everything. It answers to all five objectives.
2.	Everything on a protected objective, before anything on a flexible objective. Hard rule.
3.	Within that, by urgency, using assessRisks' existing ordering.
No write actions
Every row deep-links to its item in its own module. The dashboard routes.
________________________________________
13. Tolerance: one number, shared
The per-objective tolerance is prose and no rule uses it. The Programme's slip tolerance is a session-only dial with a four-week default owned by the Programme surface.
The dashboard imports DEFAULT_TOLERANCE_KEY and toleranceWeeksFor from the Programme's model and runs deriveRAG at exactly the Programme surface's default. It never supplies its own number.
If the two surfaces default differently, the same milestone can be amber on one screen and red on the other, and the product loses the developer's trust in one glance.
No tolerance dial on the dashboard. It is read-only and has no business offering a sensitivity control.
________________________________________
14. States and empty states
No locked Brief. The dashboard does not open. Its entry point is disabled: Lock your Brief to open the dashboard.
Brief locked, no programme baseline. The dashboard opens and works. Objective states read from risks and actions only. The caveat fires. Facts 2, 3 and 4 read Not set. Nudges to Programme set-up.
Brief locked, baseline locked, no risks scored. Every row reads Not scored. Band 1 shows Rule 0. An invitation, never a scold. One tap from every row into the Risk register.
All holding. Say it once and stop. Proportional monitoring is silent when things are fine.
________________________________________
15. Guardrails for the build
•	No new table. No writes. No AI. Not one generated word.
•	The objective health engine is a new pure engine, built and tested before any surface. It reads no clock and no database. Today is read once at the surface and passed down.
•	Copy lives with the surface, not in the engine. The engine returns states, signals and structured triggers. A copy module turns triggers into sentences, exactly as pulseRead.js already does for the Brief.
•	Percent, RAG, forecast, severity, criticality and the risk assessments are called, never recomputed.
•	project_milestones is forbidden. Read milestones only from programme_baselines.programme.
•	The criticality chip is not a component. It is inline markup in RiskRegister.js, copied again in the Action Log. Extract it once and switch all three consumers. Do not make a third copy.
•	gateReadiness is extended, not duplicated. Its header holds it back from generalisation until a second real consumer exists. The dashboard is that consumer.
________________________________________
16. Deliberately out of scope
Gate readiness as a verdict. Could you pass Gate 2 to 3 today. The right next module, not this one. Only Gate 1 to 2 exists. Fact 4 shows the count of actions bearing on the gate and makes no claim about passing it.
Portfolio roll-up. Nearly free once this engine exists. Not now.
PDF export. The obvious next artefact and the one a developer sends a lender. A pure read layer exports trivially. Not now.
Any cost, scope, quality or funding actuals. PULSE does not hold them and must not imply that it does.
________________________________________
17. Two fixes that are not M9
Both found by the reconnaissance, both parked.
1.	The Programme's lock screen does not warn when the assembled baseline misses the target completion date. Pilot developers will lock plans that cannot reach their own dates. The dashboard now catches it afterwards. The lock screen should catch it before.
2.	Make the wizard's per-objective tolerance structured. One number instead of prose, and every objective becomes testable rather than just Time.
________________________________________
18. Locked decisions
1.	The dashboard is organised by objective, not by module.
2.	Two ladders, three states each. Not scored sits off the ladder and never renders green.
3.	A flexible objective needs two Serious risks to reach Exhausted; a protected one needs one to reach Compromised.
4.	Accepted risks count in Band 2 and do not appear in Band 3.
5.	Unlinked items are absent from Band 2 and named in Band 1's caveat. Never silently absent.
6.	Time is tested against the target, not the baseline. Both dates named on fact 3.
7.	Protected Time has no grace band. Non-negotiable means no tolerance.
8.	Flexible Time never reaches Exhausted from the date signal alone.
9.	Gates never appear in Band 2. They sort above everything in Band 3.
10.	Classification drift is surfaced on the row, never averaged.
11.	The dashboard runs at the Programme surface's tolerance default and offers no dial.
12.	The project state derives from the scored protected objectives, never from the programme RAG.
13.	The dashboard is read-only. It routes, it does not act.
14.	Band 3 caps at five rows.
