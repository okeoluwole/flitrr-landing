/**
 * The curated programme template (Step 7 Brief programme update, sub-step 1a).
 * A versioned, region-neutral schedule skeleton for a property development: the
 * eight Flitrr Framework lifecycle stages (0 to 7), each with a typical gate
 * duration in weeks, one or more key milestones, and any location-sensitive
 * checkpoints.
 *
 * What this module is, and is not:
 *   - It is curated reference data, not statute. Every gate duration and every
 *     milestone offset is a tunable estimate (see `basis`), a sensible default a
 *     project starts from and then adjusts. The template asserts no statutory
 *     value.
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

// Bump when a curated duration, offset, milestone, or checkpoint changes, so a
// project can record which template version it was planned against.
export const PROGRAMME_TEMPLATE_VERSION = '1.0.0';

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
  // Gate durations and milestone offsets are tunable curated estimates,
  // expressed in whole weeks. They carry no statutory force.
  basis: 'curated estimate',
  unit: 'weeks',
  region: 'neutral',
  stages: [
    {
      stage: 0,
      name: 'Land and Site Acquisition',
      gateWeeks: 12,
      milestones: [
        {
          key: 'heads_of_terms',
          name: 'Heads of terms agreed',
          serves: SERVED_OBJECTIVES.COST,
          offsetWeeks: 6,
        },
      ],
      locationSensitive: [],
    },
    {
      stage: 1,
      name: 'Project Objectives and Funding',
      gateWeeks: 8,
      milestones: [
        {
          key: 'finance_committed',
          name: 'Development finance committed',
          serves: SERVED_OBJECTIVES.FUNDING,
          offsetWeeks: 6,
        },
      ],
      locationSensitive: [],
    },
    {
      stage: 2,
      name: 'Consultant Appointment',
      gateWeeks: 6,
      milestones: [
        {
          key: 'lead_consultant',
          name: 'Lead consultant appointed',
          serves: SERVED_OBJECTIVES.QUALITY,
          offsetWeeks: 4,
        },
      ],
      locationSensitive: [],
    },
    {
      stage: 3,
      name: 'Design and Planning Approvals',
      gateWeeks: 30,
      milestones: [
        {
          key: 'planning_validated',
          name: 'Planning application validated',
          serves: SERVED_OBJECTIVES.TIME,
          offsetWeeks: 14,
        },
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
      milestones: [
        {
          key: 'tenders_returned',
          name: 'Tenders returned',
          serves: SERVED_OBJECTIVES.COST,
          offsetWeeks: 8,
        },
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
      milestones: [
        {
          key: 'superstructure',
          name: 'Superstructure complete',
          serves: SERVED_OBJECTIVES.TIME,
          offsetWeeks: 26,
        },
        {
          key: 'finishing',
          name: 'Finishing complete',
          serves: SERVED_OBJECTIVES.QUALITY,
          offsetWeeks: 44,
        },
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
      milestones: [
        {
          key: 'completion_certificate',
          name: 'Building Regulations completion certificate issued',
          serves: SERVED_OBJECTIVES.QUALITY,
          offsetWeeks: 4,
        },
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
      milestones: [
        {
          key: 'first_exchange',
          name: 'First unit exchanged',
          serves: SERVED_OBJECTIVES.FUNDING,
          offsetWeeks: 8,
        },
      ],
      locationSensitive: [],
    },
  ],
});
