/**
 * Programme milestone view (Step 7 Brief programme update, sub-step 1d). The pure
 * derivation behind the Step 7 milestone section. It turns four inputs into the
 * read-only view the UI renders:
 *   - the curated template (lib/engine/programmeTemplate.js): the locked
 *     milestones per stage (homed under the stage's activities and read as one
 *     ordered list through stageMilestones), the objective each serves, and the
 *     stage's location-sensitive flags;
 *   - the developer's programme choices (the gate rows, with each stage's N/A
 *     flag and the per-milestone chosen date and note, keyed by the stable
 *     milestone key, sub-step 1b);
 *   - the project's objective rows, for the live criticality join;
 *   - the project start date, the lower bound for the first applicable stage.
 *
 * Per stage it yields whether the stage is applicable (not marked not applicable
 * at the gate step), and for an applicable stage each template milestone with:
 *   - its name and the objective it serves, read-only from the template;
 *   - its criticality, derived LIVE from the served objective via the engine
 *     kernel (classifyByType): critical when that objective is non-negotiable,
 *     standard otherwise. This is the same rule risks derive on, joined by the
 *     objective_type the template's `serves` now carries. Never stored: the
 *     choices layer persists only the date and the note.
 *   - the developer's chosen date and note, read by the stable key;
 *   - a date window, the surrounding chosen gate dates where those are known: the
 *     stage's window start as the lower bound, this stage's own gate as the upper
 *     bound, each left open when its gate has no chosen date. Guidance for the
 *     date input, not a hard reality-check.
 * plus the stage's location-sensitive flags (label and prompt), passed through.
 *
 * WHERE THE WINDOW OPENS is the stage-state model's answer (lib/engine/
 * stageStates.js), not this module's:
 *   - a sequential stage opens at the previous applicable gate (the project
 *     start for the first applicable stage). Strict, and the only model for
 *     stages 0 to 6;
 *   - a concurrent stage opens at its declared window anchor, an earlier gate,
 *     so its milestones may fall across the whole programme. Stage 7 in an
 *     off-plan scheme opens at the consent gate, sales launch, which is what
 *     lets "First unit exchanged" be dated during construction instead of only
 *     after practical completion;
 *   - a complete stage has no lower bound: its dates are history and may
 *     predate anything the project holds.
 * Supplying no states leaves every stage sequential, which is exactly the
 * behaviour before the model existed.
 *
 * Derives; stores nothing. No DB, no React, no clock, so the same inputs always
 * give the same view and it is unit-testable in isolation.
 */

import { buildObjectiveIndex, classifyByType } from './criticality.js';
import { stageMilestones } from './programmeTemplate.js';
import {
  WINDOW_ANCHOR_KIND,
  isComplete,
  stageStateFor,
  stageStateLookup,
} from './stageStates.js';

// Trim a date value to a non-empty string, or null. An empty control value ('')
// or a null from the database reads as "not set", which leaves a bound open.
function present(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

// Normalise the supplied programme choices into a stage-keyed lookup. Accepts the
// programme choices object ({ stages: [...] }, as loadProgrammeChoices returns)
// or a plain array of per-gate choices; each entry carries { stage, target_date,
// target_na, milestones }.
function choiceLookup(gateChoices) {
  const list = Array.isArray(gateChoices)
    ? gateChoices
    : (gateChoices?.stages ?? []);
  const lookup = new Map();
  for (const choice of list) {
    if (choice == null || choice.stage == null) continue;
    lookup.set(choice.stage, choice);
  }
  return lookup;
}

/**
 * Resolve a stage's lower bound from its state.
 *
 * A sequential stage keeps the strict bound passed in: the previous applicable
 * gate's chosen date, or the project start for the first applicable stage.
 *
 * A complete stage has no lower bound. Its dates are history and may predate
 * the project start the Brief holds, so bounding them would be a false floor.
 *
 * A concurrent stage opens at the gate its state declares, an earlier stage's
 * gate, taking that gate's CHOSEN date. Where the anchor stage is marked not
 * applicable the search steps back to the nearest applicable stage before it,
 * because a stage that was removed from the programme carries no date. It stops
 * at the first applicable stage it reaches: if the developer has not dated that
 * gate the bound is open, exactly as an undated surrounding gate leaves it open
 * in the strict model. The bound never narrows to the sequential one, because a
 * concurrent stage genuinely starts earlier.
 *
 * chosenByStage holds an entry for every applicable stage already walked, whose
 * value is the chosen date or null; a not-applicable stage has no entry at all,
 * which is what distinguishes "removed" from "not yet dated".
 */
function resolveMinDate(stage, stageState, sequentialMin, chosenByStage) {
  if (isComplete(stageState)) return null;
  const anchor = stageState?.windowAnchor;
  if (anchor?.kind !== WINDOW_ANCHOR_KIND.STAGE_GATE) return sequentialMin;
  if (typeof anchor.stage !== 'number' || anchor.stage >= stage) {
    return sequentialMin;
  }
  for (let s = anchor.stage; s >= 0; s -= 1) {
    if (chosenByStage.has(s)) return chosenByStage.get(s);
  }
  return null;
}

/**
 * Derive the milestone view for the whole programme.
 *
 * template      the programme template (PROGRAMME_TEMPLATE), or the same shape.
 * gateChoices   the programme choices ({ stages: [...] }) or a per-gate array,
 *               each entry carrying { stage, target_date, target_na, milestones }.
 * objectives    the project's objective rows ({ id, objective_type,
 *               classification }), the wizard's live objective state. A served
 *               objective joins to these by objective_type, the kernel's type key.
 * projectStart  the project start date (a 'YYYY-MM-DD' string, a Date, or empty),
 *               the lower bound for the first applicable stage's milestones.
 * stageStates   optional stage states (deriveStageStates' output, or a per-stage
 *               array). Omitted, every stage reads as sequential.
 *
 * Returns:
 *   {
 *     version,
 *     stages: [
 *       {
 *         stage, name,
 *         applicable,        false for a stage marked not applicable
 *         state,             'sequential' | 'concurrent' | 'complete'
 *         milestones: [
 *           { key, name, serves, criticality, date, note, minDate, maxDate }
 *         ],                 empty for a not-applicable stage
 *         locationSensitive: [ { label, prompt } ]   empty for not-applicable
 *       }
 *     ]
 *   }
 */
export function deriveMilestoneView(
  template,
  gateChoices,
  objectives,
  projectStart,
  stageStates
) {
  const { byType } = buildObjectiveIndex(objectives);
  const choiceByStage = choiceLookup(gateChoices);
  const stateByStage = stageStateLookup(stageStates);

  // The lower-bound anchor carried across stages: the previous applicable gate's
  // chosen date, or the project start for the first applicable stage. Null leaves
  // the bound open (a surrounding gate that has no chosen date).
  let firstApplicableSeen = false;
  let prevApplicableChosen = null;
  const startBound = present(projectStart);
  // Each applicable stage's own chosen gate date, so a concurrent stage can open
  // its window at an earlier gate the developer has dated.
  const chosenByStage = new Map();

  const stages = (template?.stages ?? []).map((stageDef) => {
    const choice = choiceByStage.get(stageDef.stage) ?? {};
    const applicable = choice.target_na !== true;
    const stageState = stageStateFor(stateByStage, stageDef.stage);

    if (!applicable) {
      // A not-applicable stage shows no milestones and no flags, and it is not a
      // surrounding gate for the next stage (it carries no date), so the anchor
      // is left untouched.
      return {
        stage: stageDef.stage,
        name: stageDef.name,
        applicable: false,
        state: stageState.state,
        milestones: [],
        locationSensitive: [],
      };
    }

    const ownChosen = present(choice.target_date);
    // The stage window: the stage's window start below, this stage's own gate
    // above. Each is open when its gate has no chosen date.
    const sequentialMin = firstApplicableSeen ? prevApplicableChosen : startBound;
    const minDate = resolveMinDate(
      stageDef.stage,
      stageState,
      sequentialMin,
      chosenByStage
    );
    const maxDate = ownChosen;

    const milestoneChoices = choice.milestones ?? {};
    const milestones = stageMilestones(stageDef).map((m) => {
      const mc = milestoneChoices[m.key] ?? {};
      return {
        key: m.key,
        name: m.name,
        serves: m.serves,
        criticality: classifyByType(m.serves, byType),
        // The developer's chosen values, passed through untrimmed so the
        // controlled inputs behave normally; persistence trims them (1b).
        date: mc.target_date ?? '',
        note: mc.note ?? '',
        minDate,
        maxDate,
      };
    });

    firstApplicableSeen = true;
    prevApplicableChosen = ownChosen;
    chosenByStage.set(stageDef.stage, ownChosen);

    return {
      stage: stageDef.stage,
      name: stageDef.name,
      applicable: true,
      state: stageState.state,
      milestones,
      locationSensitive: (stageDef.locationSensitive ?? []).map((p) => ({
        label: p.label,
        prompt: p.prompt,
      })),
    };
  });

  return { version: template?.version ?? null, stages };
}
