/**
 * Programme schedule derivation (Step 7 Brief programme update, sub-step 1a).
 * Turns a project start date plus the curated programme template (see
 * lib/engine/programmeTemplate.js) into advised dates for every gate and
 * milestone. Pure and deterministic: no DB, no React, no network, no system
 * clock, so the same inputs always give the same dates and the whole module is
 * unit-testable in isolation. It derives; it stores nothing.
 *
 * The two rules, both cumulative from the project start:
 *   - Gate advised date. Each stage's gate is the previous stage's gate advised
 *     date plus this stage's gate duration. Stage 0 has no previous gate, so it
 *     counts from the project start. The running date carries forward across the
 *     stages.
 *   - Milestone advised date. The start of a stage is its WINDOW START, which is
 *     the previous gate advised date for a sequential stage (the project start
 *     for stage 0) and the declared window anchor for a concurrent one. A
 *     milestone falls at that window start plus its offset.
 *
 * Stage states. Which stage start applies is the stage-state model's answer, not
 * this module's (lib/engine/stageStates.js). A sequential stage starts at the
 * previous applicable gate, which is the strict model these derivations were
 * built on and the only model for stages 0 to 6. A concurrent stage overlaps the
 * stages it runs alongside, so it starts at its declared window anchor instead
 * (stage 7 at the stage 3 gate, sales launch) while its own gate stays in
 * sequence, because final disposal still follows handover. A complete stage is
 * history: it advises no gate date. Supplying no states leaves every stage
 * sequential, which is exactly the behaviour before the model existed.
 *
 * N/A stages. A stage marked N/A is skipped: it advises no gate and no
 * milestones, and the running gate date carries forward unchanged, so the next
 * applicable stage starts where the last applicable stage's gate left off.
 *
 * The two-level template homes milestones under activities, so a stage's
 * milestones are read through stageMilestones (the one place that flattens
 * activities into the ordered milestone list). A milestone's offset is still
 * measured from the STAGE start, so the advised dates are unchanged by the
 * re-homing. The gate is still placed by `gateWeeks`, not the summed activity
 * span, so the advised gate dates are unchanged too (see programmeTemplate.js,
 * the gate timing note).
 *
 * Weeks are whole seven-day spans added in UTC, so a result never drifts across
 * a daylight-saving boundary. Advised dates are returned as Date objects at the
 * same UTC instant as the project start (midnight UTC when the start is a plain
 * date), so read them with UTC methods.
 */

import { stageMilestones } from './programmeTemplate.js';
import {
  STAGE_STATE,
  WINDOW_ANCHOR_KIND,
  stageStateFor,
  stageStateLookup,
} from './stageStates.js';

// One week in milliseconds. Weeks are whole seven-day spans, so adding them in
// epoch milliseconds is exact and timezone-neutral.
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Normalise the project start to epoch milliseconds. Accepts a Date, an ISO date
// string (a plain YYYY-MM-DD is parsed as UTC), or epoch milliseconds.
function toEpoch(projectStart) {
  if (projectStart instanceof Date) {
    const epoch = projectStart.getTime();
    if (Number.isNaN(epoch)) {
      throw new Error('deriveAdvisedDates: projectStart is an invalid Date');
    }
    return epoch;
  }
  if (typeof projectStart === 'number') return projectStart;
  if (typeof projectStart === 'string') {
    const epoch = Date.parse(projectStart);
    if (Number.isNaN(epoch)) {
      throw new Error('deriveAdvisedDates: projectStart is not a valid date string');
    }
    return epoch;
  }
  throw new Error(
    'deriveAdvisedDates: projectStart must be a Date, an ISO date string, or epoch milliseconds'
  );
}

// Add a whole number of weeks (zero or more) to an epoch, returning a Date.
function addWeeks(epochMs, weeks) {
  return new Date(epochMs + weeks * MS_PER_WEEK);
}

/**
 * Resolve where a stage's internal dates are measured from: its WINDOW START.
 *
 * A sequential stage (and a complete one, whose own history still sits after
 * whatever preceded it) starts at the sequential start passed in, which is the
 * previous applicable gate's date, or the project start for the first
 * applicable stage. That is the strict model, unchanged.
 *
 * A concurrent stage starts at the gate its state declares as the window
 * anchor, an EARLIER stage's gate. The anchor stage may itself be N/A or
 * undated, so the search walks back from the anchor to the nearest earlier
 * stage that holds a date, and falls back to the sequential start if none does.
 * Falling back never widens the window beyond the strict model, so a missing
 * anchor degrades to the old behaviour rather than to no validation at all.
 *
 * A window anchor that is not strictly before the stage is ignored: a stage
 * cannot open at a gate that has not happened yet in the chain.
 */
function resolveWindowStart(stage, stageState, sequentialStartEpoch, gateEpochByStage) {
  const anchor = stageState?.windowAnchor;
  if (anchor?.kind !== WINDOW_ANCHOR_KIND.STAGE_GATE) return sequentialStartEpoch;
  if (typeof anchor.stage !== 'number' || anchor.stage >= stage) {
    return sequentialStartEpoch;
  }
  for (let s = anchor.stage; s >= 0; s -= 1) {
    const epoch = gateEpochByStage.get(s);
    if (epoch != null) return epoch;
  }
  return sequentialStartEpoch;
}

/**
 * Derive advised dates for the whole programme.
 *
 * projectStart  a Date, an ISO date string, or epoch milliseconds.
 * template      the programme template (PROGRAMME_TEMPLATE), or any object with
 *               the same { version, stages: [{ stage, name, gateWeeks,
 *               activities | milestones, locationSensitive }] } shape. Milestones
 *               are read through stageMilestones, so a two-level stage (with
 *               activities) and a legacy one-level stage (with a flat milestones
 *               array) both work.
 * naStages      optional iterable (array or Set) of stage numbers marked N/A.
 * stageStates   optional stage states (deriveStageStates' output, or a per-stage
 *               array). Omitted, every stage reads as sequential and the whole
 *               derivation is unchanged. A concurrent stage takes its declared
 *               window anchor as its stage start, so its milestones advise from
 *               that anchor rather than from the previous gate; its own gate
 *               still advises in sequence.
 *
 * Returns:
 *   {
 *     version,           echoed from the template for traceability
 *     projectStart,      Date, the normalised start
 *     stages: [
 *       {
 *         stage, name,
 *         applicable,        false for an N/A stage
 *         state,             'sequential' | 'concurrent' | 'complete'
 *         gateWeeks,         the template's gate duration, for reference
 *         stageStart,        Date, or null when not applicable: the window start
 *                            the milestone offsets are measured from
 *         gateAdvisedDate,   Date, or null when not applicable
 *         milestones: [
 *           { name, serves, offsetWeeks, advisedDate }   advisedDate is a Date
 *         ],
 *         locationSensitive: [ { label, prompt } ]   passed through, flags only
 *       }
 *     ]
 *   }
 */
export function deriveAdvisedDates(projectStart, template, naStages, stageStates) {
  const startEpoch = toEpoch(projectStart);
  const naSet = naStages instanceof Set ? naStages : new Set(naStages ?? []);
  const stateByStage = stageStateLookup(stageStates);

  // The running gate date, carried forward across stages. It begins at the
  // project start, which is the start of stage 0.
  let runningGateEpoch = startEpoch;
  // The advised gate date of each applicable stage, so a concurrent stage can
  // open its window at an earlier stage's gate.
  const gateEpochByStage = new Map();

  const stages = (template?.stages ?? []).map((stageDef) => {
    const stageState = stageStateFor(stateByStage, stageDef.stage);

    if (naSet.has(stageDef.stage)) {
      // Skipped: no advised dates, and the running gate date is untouched, so it
      // carries forward to the next applicable stage.
      return {
        stage: stageDef.stage,
        name: stageDef.name,
        applicable: false,
        state: stageState.state,
        gateWeeks: stageDef.gateWeeks,
        stageStart: null,
        gateAdvisedDate: null,
        milestones: [],
        locationSensitive: [],
      };
    }

    // The gate stays in sequence whatever the stage's state: a gate closes its
    // stage, and for a concurrent stage the closing work (final disposal) still
    // follows the stages it overlapped.
    const sequentialStartEpoch = runningGateEpoch;
    const gateAdvisedDate = addWeeks(sequentialStartEpoch, stageDef.gateWeeks);

    // The window start, which is where the stage's own milestones are measured
    // from. It differs from the sequential start only for a concurrent stage.
    const stageStartEpoch = resolveWindowStart(
      stageDef.stage,
      stageState,
      sequentialStartEpoch,
      gateEpochByStage
    );

    const milestones = stageMilestones(stageDef).map((milestone) => ({
      name: milestone.name,
      serves: milestone.serves,
      offsetWeeks: milestone.offsetWeeks,
      advisedDate: addWeeks(stageStartEpoch, milestone.offsetWeeks),
    }));

    // Carry the running gate date forward for the next applicable stage.
    gateEpochByStage.set(stageDef.stage, gateAdvisedDate.getTime());
    runningGateEpoch = gateAdvisedDate.getTime();

    return {
      stage: stageDef.stage,
      name: stageDef.name,
      applicable: true,
      state: stageState.state,
      gateWeeks: stageDef.gateWeeks,
      stageStart: new Date(stageStartEpoch),
      gateAdvisedDate,
      milestones,
      locationSensitive: (stageDef.locationSensitive ?? []).map((point) => ({
        label: point.label,
        prompt: point.prompt,
      })),
    };
  });

  return {
    version: template?.version ?? null,
    projectStart: new Date(startEpoch),
    stages,
  };
}

// Soft parse to epoch milliseconds, or null. Unlike toEpoch this never throws:
// an absent, empty or unparseable value (a not-yet-set project start, a blank
// date input) is simply "no date", so the rolling chain anchors on the next
// chosen date instead of erroring. Accepts a Date, an ISO date string (a plain
// YYYY-MM-DD is parsed as UTC), or epoch milliseconds.
function softEpoch(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    const epoch = value.getTime();
    return Number.isNaN(epoch) ? null : epoch;
  }
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const epoch = Date.parse(trimmed);
    return Number.isNaN(epoch) ? null : epoch;
  }
  return null;
}

// Normalise the supplied gate choices into a stage-keyed lookup of the two
// fields the rolling chain reads: the developer's chosen gate date (as epoch
// milliseconds, or null when unset) and the N/A flag. Accepts the programme
// choices object ({ stages: [...] }, as loadProgrammeChoices returns) or a
// plain array of per-gate choices; each entry carries { stage, target_date,
// target_na }. Anything else is treated as no choices.
function gateChoiceLookup(gateChoices) {
  const list = Array.isArray(gateChoices)
    ? gateChoices
    : (gateChoices?.stages ?? []);
  const lookup = new Map();
  for (const choice of list) {
    if (choice == null || choice.stage == null) continue;
    lookup.set(choice.stage, {
      chosenEpoch: softEpoch(choice.target_date),
      na: choice.target_na === true,
    });
  }
  return lookup;
}

/**
 * Derive the rolling advised gate dates from the developer's choices so far
 * (Step 7 Brief programme update, sub-step 1c). Pure and deterministic, like
 * deriveAdvisedDates: no DB, no React, no clock. It derives; it stores nothing.
 *
 * The rule, gate by gate in stage order:
 *   - A gate's advised date is its ANCHOR DATE plus its SPAN. The anchor date is
 *     the previous applicable gate's effective date, or the project start for
 *     the first open gate; the effective date is the developer's chosen date if
 *     they set one, otherwise that gate's own advised date. The span is the
 *     stage's curated gateWeeks.
 *   - Gate 0 anchors on the project start (the start of stage 0).
 *   - An N/A stage is skipped: it advises no date, its duration is not added,
 *     and the anchor carries forward unchanged to the next applicable gate.
 *   - A complete stage advises no date. Its gate already happened, so PULSE
 *     suggests nothing for it; the developer records what occurred. Its chosen
 *     date still carries the anchor forward, and with none the anchor carries
 *     unchanged.
 *   - A concurrent stage's gate advises in sequence exactly like any other,
 *     because a gate closes its stage and the closing work still follows the
 *     stages it overlapped. What differs is its window start, below.
 *   - With no project start held yet, the anchor begins null, so an undated
 *     gate has no advised date until a chosen date seeds the chain; the later
 *     gates then roll from that previous chosen date.
 *
 * ANCHOR, SPAN AND ADVISED DATE TRAVEL TOGETHER (note 5). Each stage returns the
 * anchor date it counted from and the span it added beside the advised date it
 * produced, so a surface renders all three from one object and its helper text
 * can never cite a basis the arithmetic did not use. advisedDate is exactly
 * anchorDate plus spanWeeks whenever the anchor is held; there is no second
 * derivation anywhere for a reader to drift from.
 *
 * THE WINDOW START, separate from the gate anchor. A stage's window start is
 * where its own internal dates (its milestones) are measured from. For a
 * sequential stage it is the same as the gate anchor. For a concurrent stage it
 * is the declared window anchor, an earlier gate, so the stage's milestones may
 * fall across the whole programme rather than only after the previous gate. For
 * a complete stage the window has no lower bound at all (windowOpenStart), since
 * its dates are history and may predate anything the project holds.
 *
 * With no overrides (no chosen dates) and no states supplied, every effective
 * date equals the advised date, so the advised dates match deriveAdvisedDates
 * gate for gate. A chosen date on one gate shifts only the gates after it,
 * through the carried anchor.
 *
 * projectStart  a Date, an ISO date string, or epoch milliseconds; or empty
 *               (null, undefined or '') when no start date is held.
 * template      the programme template (PROGRAMME_TEMPLATE), or the same shape.
 * gateChoices   the programme choices ({ stages: [...] }) or a per-gate array,
 *               each entry carrying { stage, target_date, target_na }.
 * stageStates   optional stage states (deriveStageStates' output, or a per-stage
 *               array). Omitted, every stage reads as sequential and the whole
 *               derivation is unchanged.
 *
 * Returns:
 *   {
 *     version,           echoed from the template
 *     projectStart,      Date, or null when no start date is held
 *     stages: [
 *       {
 *         stage, name,
 *         applicable,      false for an N/A gate
 *         state,           'sequential' | 'concurrent' | 'complete'
 *         gateWeeks,       the template's curated gate duration
 *         spanWeeks,       the span actually added to the anchor: gateWeeks, or
 *                          null where nothing is advised (a complete stage)
 *         anchorDate,      Date or null: what the advised date counted from
 *         advisedDate,     Date, or null (N/A, complete, or no anchor yet)
 *         chosenDate,      Date, or null when the developer set no date
 *         effectiveDate,   Date, or null: the chosen date, else the advised date
 *         windowStart,     Date or null: where this stage's own dates measure
 *                          from (the window anchor for a concurrent stage)
 *         windowStartLabel, short label for a moved window start, else null
 *         windowOpenStart, true when the window has no lower bound (complete)
 *       }
 *     ]
 *   }
 */
export function deriveRollingGateDates(
  projectStart,
  template,
  gateChoices,
  stageStates
) {
  const startEpoch = softEpoch(projectStart);
  const choiceByStage = gateChoiceLookup(gateChoices);
  const stateByStage = stageStateLookup(stageStates);

  // The anchor carried forward across stages: the previous applicable gate's
  // effective date. It begins at the project start, the start of stage 0, and
  // is null when no start date is held (an undated early gate then advises
  // nothing until a chosen date seeds the chain).
  let anchorEpoch = startEpoch;
  // The effective date of each applicable gate, so a concurrent stage can open
  // its window at an earlier stage's gate.
  const gateEpochByStage = new Map();

  const stages = (template?.stages ?? []).map((stageDef) => {
    const choice = choiceByStage.get(stageDef.stage) ?? {};
    const stageState = stageStateFor(stateByStage, stageDef.stage);

    if (choice.na === true) {
      // Skipped: no advised date, its duration is not added, and the anchor
      // carries forward unchanged to the next applicable gate.
      return {
        stage: stageDef.stage,
        name: stageDef.name,
        applicable: false,
        state: stageState.state,
        gateWeeks: stageDef.gateWeeks,
        spanWeeks: null,
        anchorDate: null,
        advisedDate: null,
        chosenDate: null,
        effectiveDate: null,
        windowStart: null,
        windowStartLabel: null,
        windowOpenStart: false,
      };
    }

    // The anchor this gate counts from, held before the chain moves on so the
    // returned anchorDate is the very value the advised date was built from.
    const gateAnchorEpoch = anchorEpoch;
    const isComplete = stageState.state === STAGE_STATE.COMPLETE;
    // A complete stage's gate already happened, so nothing is advised for it.
    const spanWeeks = isComplete ? null : stageDef.gateWeeks;
    const advisedDate =
      gateAnchorEpoch == null || spanWeeks == null
        ? null
        : addWeeks(gateAnchorEpoch, spanWeeks);

    const chosenEpoch = choice.chosenEpoch ?? null;
    // The effective date carried forward: the chosen date if the developer set
    // one, otherwise this gate's own advised date (which is null before a start
    // or chosen date has seeded the chain).
    const effectiveEpoch =
      chosenEpoch != null
        ? chosenEpoch
        : advisedDate == null
          ? null
          : advisedDate.getTime();

    // The window start, resolved before the anchor moves on, so a concurrent
    // stage reads the earlier gate it opens at and a sequential one reads the
    // anchor it just used.
    const windowStartEpoch = resolveWindowStart(
      stageDef.stage,
      stageState,
      gateAnchorEpoch,
      gateEpochByStage
    );

    gateEpochByStage.set(stageDef.stage, effectiveEpoch);
    // A concurrent stage overlaps the stages it runs alongside, so it does not
    // push what follows it: the sequential anchor carries past it unchanged.
    if (stageState.state !== STAGE_STATE.CONCURRENT) {
      anchorEpoch = effectiveEpoch;
    }

    return {
      stage: stageDef.stage,
      name: stageDef.name,
      applicable: true,
      state: stageState.state,
      gateWeeks: stageDef.gateWeeks,
      spanWeeks,
      anchorDate: gateAnchorEpoch == null ? null : new Date(gateAnchorEpoch),
      advisedDate,
      chosenDate: chosenEpoch == null ? null : new Date(chosenEpoch),
      effectiveDate: effectiveEpoch == null ? null : new Date(effectiveEpoch),
      windowStart: windowStartEpoch == null ? null : new Date(windowStartEpoch),
      windowStartLabel: stageState.windowAnchorLabel ?? null,
      windowOpenStart: isComplete,
    };
  });

  return {
    version: template?.version ?? null,
    projectStart: startEpoch == null ? null : new Date(startEpoch),
    stages,
  };
}
