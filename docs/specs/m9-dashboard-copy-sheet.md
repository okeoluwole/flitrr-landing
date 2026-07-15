PULSE Project Dashboard
The copy sheet, M9.2, bands 1 and 2
________________________________________
0. The rule this sheet enforces
Nothing on this surface is generated. Every string below is selected by a rule from the engine's output. If a state can occur and has no string here, that is a gap in this sheet, not a licence to invent one.
Week figures round to the nearest whole week. Weeks throughout, never months, because the Programme surface speaks weeks and two units is a translation cost the developer pays.
Examples below use the live fixture project where they can, so the copy can be checked against a real render rather than an imagined one.
________________________________________
1. Band 1: The read
1.1 The state sentence
One only. The engine hands over sentenceRule, 0 to 5.
Rule 0. No protected objective is scored.
Nothing is scored yet, so there is no read to give. Score your risks to open it.
Rule 1. One or more protected objectives compromised.
One:
Cost is compromised. You protected it, and [reason].
Two:
Two of your protected objectives are compromised: Cost and Time.
Three or more:
Three of your protected objectives are compromised: Cost, Time and Quality.
The [reason] slot, taken from the compromised objective's trigger:
Trigger	Reason
serious_risk	a Serious risk is live against it
serious_risk, with acceptedSerious above zero	a Serious risk is live against it, and you have accepted it
programme_red	a milestone serving it has slipped past your tolerance
date_past_target	your forecast completes [N] weeks after your target
Rule 2. One or more protected objectives under pressure.
One:
Cost is under pressure. It is the only protected objective currently exposed.
Several:
Three of your four protected objectives are under pressure: Cost, Quality and Funding.
Rule 3. All scored protected holding, one or more flexible exhausted.
Cost has absorbed as much as it can. Your next setback lands on something you protected.
Rule 4. All scored protected holding, one or more flexible absorbing.
Every protected objective is holding. Cost and Scope are absorbing the pressure, which is what you classified them to do.
Rule 5. Everything holding.
Every objective is holding.
1.2 The supporting lines
At most two. Line A always precedes line B.
Line A. Over-constraint. Only when every objective is protected.
You protected all five objectives, so this project has no give. Any setback lands on something you said cannot move.
Line B. The blind spot. One only, the highest priority that fires. Each links to the module that fixes it.
1. A protected objective is Not scored.
Cost is protected and nothing is scored against it. This read cannot see it.
Two or more:
Cost and Quality are protected and nothing is scored against them. This read cannot see them.
2. Unlinked items exist.
5 risks are not linked to an objective, so they sit outside this read.
With actions too:
5 risks and 2 actions are not linked to an objective, so they sit outside this read.
3. Unscored risks exist.
6 of your 9 risks are unscored, so this read is incomplete.
4. No programme baseline is locked.
No programme baseline is locked, so schedule pressure is not in this read.
1.3 The four facts
Fact 1. Stage.
Stage 2 Consultant Appointment
Fact 2. Complete.
34% complete
No baseline:
Not set
Fact 3. Forecast completion, against target. Both dates always named.
Late:
14 April 2028 15 weeks after your target of 31 December 2027
Ahead:
14 April 2028 6 weeks before your target of 26 May 2028
On the day:
14 April 2028 Exactly your target of 14 April 2028
No target set:
14 April 2028 No target completion date set
No baseline:
Not set
Fact 4. Next gate. It makes no claim about whether the gate can be passed.
Gate 2 to 3 12 September 2026. 3 open actions bear on it, 2 critical.
No open actions:
12 September 2026. No open actions bear on it.
No baseline:
Not set
No gate ahead:
No gate ahead
________________________________________
2. Band 2: Objective health
2.1 State labels
Protected: Holding, Under pressure, Compromised Flexible: Holding, Absorbing, Exhausted Either: Not scored
2.2 The reason line
One per row, selected by the engine's trigger key. Every key the engine can emit must appear in this table. A key with no string is a build error, never a fallback to a generic line.
Trigger	Copy
holding	Nothing is currently pressing on Cost.
serious_risk	A Serious risk is live against Cost.
serious_risk with acceptedSerious	A Serious risk is live against Cost, and you have accepted it.
moderate_risk, one	A risk worth watching is live against Cost.
moderate_risk, several	Three risks worth watching are live against Cost.
two_serious_risks	Two Serious risks are live against Cost. It has no give left.
open_critical_actions, one	A critical action is open against Cost.
open_critical_actions, several	Two critical actions are open against Cost.
programme_red	A milestone serving Cost has slipped past your tolerance.
programme_amber	A milestone serving Cost is slipping.
date_past_target	Carried by the date line. See 2.4.
not_scored	See 2.3.
Where more than one thing is true, the reason names the one that set the state. The rest are visible in the expansion.
2.3 The Not scored line
No milestones:
Nothing scored against Cost yet.
With milestones, none flagged. Credit the work rather than dismissing it:
Nothing scored against Scope yet. Two milestones serve it and neither has slipped, but no risk has been assessed.
One tap to the Risk register. A Not scored row is never a dead end.
2.4 The Time date line
Rendered whenever dateSignal exists, independent of what set the state. Time only.
Planning gap only. plannedWeeksLate above zero, slippedWeeks zero.
The programme you locked completes 22 weeks after your target. That was true the day you locked it.
Delivery gap only. plannedWeeksLate zero or negative, slippedWeeks above zero.
Your forecast completes 8 weeks after your target. The plan was sound; delivery has slipped.
Both gaps. Both above zero.
Your forecast completes 30 weeks after your target. 22 were baked in when you locked the programme, and 8 have slipped since.
Planning gap, pulling back, still late. This is the live fixture.
Your forecast completes 15 weeks after your target. 22 were baked in when you locked the programme, and you have pulled back 7. It is not enough.
Planning gap, pulled back to clear.
You locked a programme that missed your target by 22 weeks. You have pulled back 25, and you are now forecast to make it.
No room. Verdict no_room.
You are forecast to make your target with 2 weeks in hand. There is no room left.
Clear. Verdict clear.
Your forecast completes 9 weeks before your target.
On a Not scored Time row, both lines render.
Nothing scored against Time yet. Separately: your forecast completes 15 weeks after your target.
The row says what we do not know, and it says what we do. Neither claim contaminates the other.
2.5 The drift notice
Live protected, baked standard:
Cost is protected, but your locked programme still monitors it as standard. Re-baseline to bring them into line.
Live flexible, baked critical:
Cost is flexible, but your locked programme still monitors it as critical. Re-baseline to bring them into line.
2.6 The expansion
Group headers, only where the group has items:
Risks Actions Milestones
Each item shows enough to be understood without leaving the page.
•	Risk: description, severity chip, status.
•	Action: description, criticality chip, status.
•	Milestone: name, stage, baseline date, and its flag where it has one.
One link per group, never per item:
Open in Risk register Open in Action Log Open in Programme
________________________________________
3. The page
Title:
Project dashboard
Sub:
Where the project stands against the objectives you set.
Brief not locked:
Lock your Brief to open the dashboard. Your objectives are set in the Brief, and this page reads through them.
