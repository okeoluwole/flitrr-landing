PULSE Workspace Phase Model (M9.4)
Design specification, LOCKED
Reconciled against the M9.4.0 reconnaissance
________________________________________
0. What this is
The workspace shows the same flat set of tiles regardless of how far a project has been set up. This introduces the phase: a derived reading of where a project sits in its own set-up, which decides what each tile does.
This is a gating and copy change to the workspace and to two module guards. It is derivation, not storage. No new table, no new column, no migration. The phase is a pure function of state PULSE already holds.
The vocabulary rename ("baseline" as the Brief's name for itself) is a separate pass and is not in this sub-step.
The landing flip (the dashboard replacing the workspace as the project home) is M9.5 and is not in this sub-step. M9.4 changes what each phase shows. M9.5 changes where the project opens.
________________________________________
1. The three phases
Phase	Meaning
Define	The Brief is not locked. The project is being defined.
Plan	The Brief is locked. The Programme baseline is not. The project is being planned.
Run	The Brief is locked and the Programme baseline is locked. The project is being delivered.
The hinge is principle 4: you do not monitor until you have something to monitor against. Each lock opens the next phase.
________________________________________
2. The derivation, and it is pure
Two inputs, both already read by the workspace today: briefLocked and hasBaseline.
phase =
  not briefLocked                    -> Define
  briefLocked and not hasBaseline    -> Plan
  briefLocked and hasBaseline        -> Run
The phase is derived on every read, never stored. This matters because of two states the reconnaissance surfaced.
Plan is reversible. The Brief can be unlocked before the gate. A project can move Plan back to Define. A stored phase would go stale on unlock. A derived one cannot.
The reopened Brief. A developer can lock the Programme, then reopen the Brief. That is briefLocked = false, hasBaseline = true. Under the derivation above it reads Define, and that is correct: the Brief is the project spine, and if it is open, the project is being redefined, whatever else exists. The live baseline waits. This is a deliberate decision, stated so it is never treated as an edge case to be papered over.
The phase must never be derived from current_stage. The reconnaissance is explicit: current_stage can be 1 in all three phases, so it carries no phase information. The phase comes from the two locks, nothing else.
________________________________________
3. What each phase shows
The gate at issue throughout is the Gate 1 to 2, which advances current_stage and is a separate, deliberate act taken after the Brief locks. It is not a lock. Call it "the gate" below.
The reconnaissance established the true sequence: lock Brief (current_stage still 1), then pass the gate (current_stage becomes 2), then the lifecycle advances. Risk and the Action Log today both gate on current_stage >= 2. This sub-step separates them.
The rule, stated once
Risk is a baselining act. It re-gates on the Brief lock. The Action Log is a delivery act. It stays on the gate.
They were only ever gated together because the code happened to gate them the same way. They are different kinds of thing and this sub-step separates them.
Define (Brief not locked)
Tile	State	Why
Brief	Open	The one thing to do in Define.
Risk register	Locked	Opens when the Brief locks.
Programme	Locked	Opens when the Brief locks.
Action Log	Locked	Opens at the gate.
Dashboard	Locked	Opens when the Brief locks.
Plan (Brief locked, Programme not locked)
Tile	State	Why
Brief	Open	Locked, revisable until the gate.
Risk register	Open	Re-gated on the Brief lock. This is the change.
Programme	Open	Set-up, ready to build and lock a baseline.
Dashboard	Open	Reads from risks and actions; the caveat line handles the missing baseline.
Action Log	Locked, with a message	Still on the gate. See 4.
Run (both locked)
Run has two sub-states, because the reconnaissance confirmed a developer can lock the Programme while still at current_stage = 1, before ever passing the gate.
Tile	Run, gate passed	Run, gate not passed
Brief	Open	Open
Risk register	Open	Open
Programme	Open, tracking	Open, tracking
Dashboard	Open	Open
Action Log	Open	Locked, with a message
The both-locked-but-gate-not-passed state is legitimate and is left to stand. The Action Log does not sit dead in it; it carries an honest message that names the gate and points at it. See 4.
________________________________________
4. The Action Log locked message
The Action Log is the one tile that stays gated on the gate through Plan and into gate-not-passed Run. It never shows a dead or "coming soon" state. It tells the truth about why it is locked and what opens it.
In Define:
Opens once you lock your Brief and pass the gate into Stage 2.
In Plan, and in Run before the gate:
Pass the gate into Stage 2 to start logging actions.
The second message is a nudge. A developer who has reached Run without the gate is watching a live dashboard and can score risks; the Action Log tells them plainly that one deliberate step, the gate, opens the last piece. That is the framework speaking, not an arbitrary wall.
________________________________________
5. The exact changes
5.1 Re-gate the Risk register on the Brief lock
Two places, both found by the reconnaissance, and both must change together or the tile and the page will disagree.
The workspace tile. Today the Risk tile computes its state from stage2Reached. Change it to compute from briefLocked.
The Risk page's own guard. risk/page.js today blocks below current_stage >= 2 with "Risk monitoring opens once you pass the gate into Stage 2." Change the guard to block on not briefLocked, and change the copy to match:
Risk monitoring opens once you lock your Brief.
Nothing else gates the Risk register. RLS is per owner and organisation, not stage based.
5.2 The Action Log stays on the gate, message updated
The Action Log tile and the Action Log page keep gating on current_stage >= 2. Only the locked copy changes, to the two messages in section 4. Do not re-gate the Action Log on the Brief lock. Its dependence on the gate is deliberate under this design.
5.3 The phase helper
A single pure function, the one place the phase is derived. Every tile reads its state through the phase, not through its own inline boolean. This replaces the current pattern where briefLocked, hasBaseline and stage2Reached are read ad hoc per tile.
The helper takes briefLocked and hasBaseline and returns the phase. Tile state then follows from the phase plus, for the Action Log only, whether the gate is passed. The Programme tile's existing three-way branch already embodies this and can be read as the model.
5.4 The intro line follows the phase
The workspace intro currently reads as a single static instruction. It should speak to the phase the project is in, so a developer in Run is not told to set up a baseline they locked weeks ago. One line per phase, and the phase copy is the deliverable of the redline, not fixed here.
________________________________________
6. What does not change
•	No stored phase. Derived on every read.
•	No new precondition on any lock. The Programme lock does not gain a "gate first" requirement. The gate-not-passed Run state is left to stand, handled by the Action Log message.
•	The Gate 1 to 2 is untouched. It keeps advancing current_stage and it keeps governing the Action Log. It is not demoted.
•	No landing change. The project still opens to the workspace. M9.5 changes that.
•	No vocabulary rename. "Baseline" as the Brief's own name is a separate pass.
•	The 'soon' tile state stays unused unless a phase genuinely needs a "later" affordance distinct from "locked". It does not appear to.
________________________________________
7. Out of scope, named
•	M9.5, the landing flip. The dashboard becoming the project home once the Programme locks. The seam is the single href in ProjectList.js plus the workspace page. Not now.
•	The baseline vocabulary rename. Roughly ten strings on the Brief flow where "baseline" is the Brief's name for itself. The framework gives "baseline" to the Programme; the Brief should give the word up. Its own pass.
•	The duplicated stage-name maps. Five copies of the stage labels across the codebase. Note it if the phase work touches labelling; do not add a sixth. Not a target here.
________________________________________
8. Locked decisions
1.	The phase is derived from the two locks, never stored, never from current_stage.
2.	Define, Plan, Run, gated by the Brief lock and the Programme baseline lock.
3.	The reopened Brief (Brief unlocked, baseline exists) reads Define.
4.	Risk re-gates on the Brief lock, in both the tile and the page guard.
5.	The Action Log stays on the Gate 1 to 2, with an honest locked message.
6.	The both-locked-but-gate-not-passed Run state is left to stand.
7.	The gate is not demoted and gains no new role. No lock gains a new precondition.
8.	The vocabulary rename and the landing flip are separate sub-steps.
