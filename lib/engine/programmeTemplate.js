/**
 * The curated programme template (Step 7 Brief programme update, sub-step 1a;
 * extended to two levels by Programme module Phase 1 Foundation). A versioned,
 * region-neutral schedule skeleton for a property development: the eight Flitrr
 * Framework lifecycle stages (0 to 7), each now an ordered list of activities
 * with a typical duration, the key milestones re-homed onto the activity each
 * sits under, a typical gate duration in weeks, and any location-sensitive
 * checkpoints.
 *
 * The two-level shape, the structural spine of the Programme module:
 *   - A stage holds an ordered `activities` array, two activities as the norm
 *     and three for Construction (stage 5). Each activity carries a stable
 *     `key`, a `name`, a first-draft `typicalWeeks` duration, a generous
 *     `withinNormWeeks` band ({ min, max }) the later reality check works from,
 *     and the `milestones` that sit under it (which may be empty for now).
 *   - The gate stays at the stage boundary and closes the stage's final
 *     activity. The stage also keeps its `gateWeeks`, the curated gate duration
 *     the Brief's advised dates derive from today (see "the gate timing" note
 *     below).
 *   - Milestones are unchanged. Each is re-homed under an activity, not edited:
 *     it keeps its stable `key`, `name`, `serves`, and `offsetWeeks`, and the
 *     offset is still measured from the STAGE start, not the activity start, so
 *     the advised dates the Brief derives do not move.
 *
 * What this module is, and is not:
 *   - It is curated reference data, not statute. Every gate duration, activity
 *     duration, and milestone offset is a tunable first-draft estimate (see
 *     `basis`), a sensible default a project starts from and then adjusts. The
 *     template asserts no statutory value.
 *   - Location-sensitive points are FLAGS ONLY. Each carries a plain-language
 *     label and a prompt to confirm the local requirement, and no numeric value,
 *     because the framework tailors within discipline (geography changes the
 *     detail, never the gate logic) and PULSE must not pretend to know a
 *     jurisdiction's statutory periods. The source content gave each checkpoint
 *     as one phrase, "subject, confirm requirement"; it is split here into the
 *     subject (label) and the confirm instruction (prompt), wording preserved.
 *   - Each milestone records the objective it serves, one of the five framework
 *     objectives, by the objective_type identifier the criticality kernel joins
 *     on (lib/engine/criticality.js). That `serves` link is the spine the
 *     monitoring engine reads to derive the milestone's criticality from the
 *     served objective's live classification, the same rule risks derive on. The
 *     identifier joins straight to a project's objective rows, with no name
 *     mapping. This module stores the link; it does NOT compute criticality. No
 *     governance decision here.
 *   - Each milestone also carries a short stable `key`, unique within its stage.
 *     The key is the identity a stored programme choice references (a developer's
 *     chosen date or note is keyed by stage plus this key), so a choice stays
 *     bound to the right milestone even if this array is reordered or a milestone
 *     is later renamed. Never key a choice by display name or array position. The
 *     pure date derivation ignores the key; it is for persistence only.
 *   - Each activity also carries a short stable `key`, unique across the whole
 *     template and distinct from every milestone key. It is the identity Phase 2
 *     persistence will reference when it stores the assembled programme, on the
 *     same never-by-position discipline the milestone keys hold to.
 *
 * The gate timing, flagged not reconciled at this step. In the target Programme
 * model a stage's span is the sum of its activities' durations and the gate
 * falls at the end of the final activity, so `gateWeeks` is ultimately derived
 * from the activities. It is NOT reconciled here. The first-draft activity
 * durations do not sum to the shipped `gateWeeks` for seven of the eight stages
 * (only stage 4 agrees), and `gateWeeks` is what the live, locked Project Brief
 * already derives its advised gate dates from. Switching the gate onto the
 * activity sums now would silently re-tune the Brief's whole programme with
 * un-pressure-tested numbers, the un-reviewed baseline drift the framework
 * forbids. So this step keeps `gateWeeks` authoritative and byte-stable, holds
 * the summed activity span alongside it as a derived figure (stageActivityWeeks),
 * and leaves the reconciliation to the Phase 1.1 reality check and Phase 2
 * assembly, where the developer is in the loop. See stageActivityWeeks.
 *
 * Pure data. No DB, no React, no network, no clock. The pure derivation that
 * turns this template plus a project start date into advised dates lives in
 * lib/engine/programmeSchedule.js.
 */

// The five framework objectives a milestone can serve, named by the
// objective_type identifier the criticality kernel joins on (lib/engine/
// criticality.js: buildObjectiveIndex's byType, classifyByType), the same key a
// project's objective rows carry. Storing the kernel identifier here, not a
// display name, keeps the milestone-to-objective join clean: a consumer derives a
// milestone's criticality straight from the served objective's live
// classification, with no name mapping. The UI resolves the human label from the
// shared objective metadata (objectiveMeta.js) when it needs one. Stored on the
// template only; criticality is not computed here.
export const SERVED_OBJECTIVES = Object.freeze({
  SCOPE: 'scope',
  COST: 'cost',
  TIME: 'time',
  QUALITY: 'quality',
  FUNDING: 'funding',
});

// Bump when a curated duration, offset, milestone, activity, or checkpoint
// changes, so a project can record which template version it was planned
// against. The two-level activities shape lands at 1.1.0.
export const PROGRAMME_TEMPLATE_VERSION = '1.1.0';

/**
 * The generous within-norm band around an activity's typical duration: typical
 * plus or minus fifty percent, rounded to whole weeks, with a minimum band of
 * plus or minus two weeks. The band is wide on purpose so the later reality
 * check prompts the developer only on real divergence, never on small, normal
 * variation. Pure: a whole-number typical in, concrete whole-number { min, max }
 * out. Exported so the Phase 1.1 reality check derives the band the same way,
 * never a second copy of the rule.
 */
export function withinNormBand(typicalWeeks) {
  const half = Math.max(Math.round(typicalWeeks * 0.5), 2);
  return { min: typicalWeeks - half, max: typicalWeeks + half };
}

// Build one activity with its concrete within-norm band computed from the rule,
// so the frozen template holds plain numbers, not a deferred computation.
function activity(key, name, typicalWeeks, milestones) {
  return {
    key,
    name,
    typicalWeeks,
    withinNormWeeks: withinNormBand(typicalWeeks),
    milestones,
  };
}

// Deep freeze so the curated template is genuinely read-only at runtime: the
// pure derivation reads it and must never mutate it.
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

export const PROGRAMME_TEMPLATE = deepFreeze({
  version: PROGRAMME_TEMPLATE_VERSION,
  // Gate durations, activity durations, and milestone offsets are tunable
  // curated estimates, expressed in whole weeks. They carry no statutory force.
  basis: 'curated estimate',
  unit: 'weeks',
  region: 'neutral',
  stages: [
    {
      stage: 0,
      name: 'Land and Site Acquisition',
      gateWeeks: 12,
      activities: [
        activity('0a_site_search', 'Site search and appraisal', 12, [
          {
            key: 'heads_of_terms',
            name: 'Heads of terms agreed',
            serves: SERVED_OBJECTIVES.COST,
            offsetWeeks: 6,
          },
        ]),
        activity('0b_legal_completion', 'Acquisition and legal completion', 8, []),
      ],
      locationSensitive: [],
    },
    {
      stage: 1,
      name: 'Project Objectives and Funding',
      gateWeeks: 8,
      activities: [
        activity('1a_brief_feasibility', 'Brief and feasibility', 3, []),
        activity('1b_funding_secured', 'Funding secured', 6, [
          {
            key: 'finance_committed',
            name: 'Development finance committed',
            serves: SERVED_OBJECTIVES.FUNDING,
            offsetWeeks: 6,
          },
        ]),
      ],
      locationSensitive: [],
    },
    {
      stage: 2,
      name: 'Consultant Appointment',
      gateWeeks: 6,
      activities: [
        activity('2a_scope_selection', 'Scope and selection', 4, []),
        activity('2b_appointment_mobilisation', 'Appointment and mobilisation', 4, [
          {
            key: 'lead_consultant',
            name: 'Lead consultant appointed',
            serves: SERVED_OBJECTIVES.QUALITY,
            offsetWeeks: 4,
          },
        ]),
      ],
      locationSensitive: [],
    },
    {
      stage: 3,
      name: 'Design and Planning Approvals',
      gateWeeks: 30,
      activities: [
        activity('3a_design_development', 'Design development', 8, []),
        activity('3b_planning_approvals', 'Planning and statutory approvals', 12, [
          {
            key: 'planning_validated',
            name: 'Planning application validated',
            serves: SERVED_OBJECTIVES.TIME,
            offsetWeeks: 14,
          },
        ]),
      ],
      locationSensitive: [
        {
          label: 'Planning approval',
          prompt: 'Confirm the local statutory determination period',
        },
      ],
    },
    {
      stage: 4,
      name: 'Contractor Procurement',
      gateWeeks: 12,
      activities: [
        activity('4a_tender', 'Tender', 6, [
          {
            key: 'tenders_returned',
            name: 'Tenders returned',
            serves: SERVED_OBJECTIVES.COST,
            offsetWeeks: 8,
          },
        ]),
        activity('4b_evaluation_award', 'Evaluation and award', 6, []),
      ],
      locationSensitive: [
        {
          label: 'Public procurement timescales',
          prompt: 'Confirm which apply',
        },
      ],
    },
    {
      stage: 5,
      name: 'Construction',
      gateWeeks: 52,
      activities: [
        activity('5a_substructure', 'Substructure', 12, []),
        activity('5b_superstructure', 'Superstructure', 24, [
          {
            key: 'superstructure',
            name: 'Superstructure complete',
            serves: SERVED_OBJECTIVES.TIME,
            offsetWeeks: 26,
          },
        ]),
        activity('5c_fitout_finishing', 'Fit-out and finishing', 18, [
          {
            key: 'finishing',
            name: 'Finishing complete',
            serves: SERVED_OBJECTIVES.QUALITY,
            offsetWeeks: 44,
          },
        ]),
      ],
      locationSensitive: [
        {
          label: 'Party wall, building control and levy commencement notices',
          prompt: 'Confirm local requirements',
        },
      ],
    },
    {
      stage: 6,
      name: 'Completion and Handover',
      gateWeeks: 6,
      activities: [
        activity('6a_completion_certification', 'Completion and certification', 4, [
          {
            key: 'completion_certificate',
            name: 'Building Regulations completion certificate issued',
            serves: SERVED_OBJECTIVES.QUALITY,
            offsetWeeks: 4,
          },
        ]),
        activity('6b_handover_defects', 'Handover and defects', 6, []),
      ],
      locationSensitive: [
        {
          label: 'Completion certification and warranty sign-off',
          prompt: 'Confirm local requirements',
        },
      ],
    },
    {
      stage: 7,
      name: 'Sales and Disposal',
      gateWeeks: 20,
      activities: [
        activity('7a_marketing_sales', 'Marketing and sales', 20, [
          {
            key: 'first_exchange',
            name: 'First unit exchanged',
            serves: SERVED_OBJECTIVES.FUNDING,
            offsetWeeks: 8,
          },
        ]),
        activity('7b_completions_disposal', 'Completions and disposal', 12, []),
      ],
      locationSensitive: [],
    },
  ],
});

/**
 * The flat, ordered milestone list for a stage, walked out of its activities.
 * The two-level template homes milestones under activities, but the derivations
 * and the Brief read a stage's milestones as one flat list in order, so this is
 * the single place that flattens them: activity order, then milestone order
 * within each activity, which preserves the order the one-level template held.
 *
 * Accepts a stage in either shape. A two-level stage ({ activities }) is walked;
 * a legacy or foreign one-level stage ({ milestones }) is returned as is, so the
 * "or any object with the same shape" contract the derivations document still
 * holds. Returns a new array; never mutates the stage.
 */
export function stageMilestones(stage) {
  if (Array.isArray(stage?.activities)) {
    return stage.activities.flatMap((a) => a?.milestones ?? []);
  }
  return stage?.milestones ?? [];
}

/**
 * The summed activity span for a stage, in whole weeks: the total of its
 * activities' typical durations. This is the span the target Programme model
 * puts the gate at the end of (the gate closes the final activity). It is
 * provided as a derived figure, NOT wired into the gate position at this step:
 * the gate still derives from `gateWeeks` so the locked Brief stays byte-stable.
 * Phase 1.1 (reality check) and Phase 2 (assembly) reconcile the two with the
 * developer in the loop. For seven of the eight stages this figure does not
 * equal `gateWeeks` on the first-draft durations, which is the divergence held
 * for that reconciliation. Pure; reads activities only.
 */
export function stageActivityWeeks(stage) {
  return (stage?.activities ?? []).reduce(
    (sum, a) => sum + (a?.typicalWeeks ?? 0),
    0
  );
}
