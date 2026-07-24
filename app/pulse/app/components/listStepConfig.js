/**
 * Shared configuration for the three list-based initiation steps:
 *   Step 5  Organisation and Governance (workstreams)   -> project_workstreams
 *   Step 7  Programme (critical milestones)             -> project_milestones
 *   Step 8  Risks, Assumptions, Constraints, Dependencies (risks) -> project_risks
 *
 * The three steps share one shape: an editable, pre-filled list of items,
 * each with type-specific fields plus a shared "serves objective" link and a
 * cascading Critical / Standard criticality. This module is the single
 * source of truth for what differs between them (table, copy, fields, the
 * suggested starter set), so the shared StepItemList component and the wizard
 * shell can stay generic.
 *
 * Copy here is used verbatim (framework Section 6/7 and the M3.4 spec).
 * Punctuation discipline: no em dashes or en dashes.
 */

import {
  buildObjectiveIndex,
  toStoredCriticality,
} from '../../../../lib/engine/criticality.js';
import {
  LIKELIHOOD_OPTIONS,
  IMPACT_OPTIONS,
} from '../../../../lib/engine/severity.js';

// The risk likelihood and impact scales (risk_level enum), read from the engine
// so this capture and the register speak one vocabulary (Note 19). They used to
// be one local Low / Medium / High list serving both selects, while the register
// that reads the very same columns said Unlikely, Possible, Likely and Limited,
// Significant, Severe. The developer had to work out that their Medium and the
// register's Possible were the same answer. The stored values are unchanged;
// only the words are, and they are now written once. Both selects still default
// to medium so an inserted risk always carries a value (the columns are
// nullable, but the spec wants inserts to be rated).

// The two cascaded criticality values (criticality_level enum). The shared
// criticality control on every item renders from this.
export const CRITICALITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'standard', label: 'Standard' },
];

/**
 * The cascade rule (framework Section 6, M3.4 spec): an item linked to a
 * Non-negotiable objective defaults to Critical, anything else (a Flexible
 * objective, or no link) defaults to Standard. A thin wrapper over the engine
 * kernel (A4): it indexes the objective rows and defers to toStoredCriticality,
 * so the one write-time stamping rule lives in lib/engine. The name and
 * signature are unchanged for its callers (the wizard and the Action Log).
 *
 * `objectives` is the wizard's live objective state (id, objective_type,
 * classification, ...), so this reflects the classification set in Step 3,
 * including unsaved edits made earlier in the same session.
 */
export function cascadeCriticality(linkedObjectiveId, objectives) {
  const { byId } = buildObjectiveIndex(objectives);
  return toStoredCriticality(linkedObjectiveId, byId);
}

/**
 * Per-step configuration, keyed by a stable list key.
 *
 * `fields` are the type-specific inputs only; the shared objective link and
 * the criticality control are rendered by StepItemList itself. A field marked
 * `full` spans the full width of the item card; otherwise it sits in the
 * two-column grid alongside the link and criticality controls.
 *
 * `requiredField` is the one field that gives an item its identity. It maps
 * to the table's NOT NULL column, so a row left blank there is dropped on
 * save (see persistList in the shell) rather than sent an empty value.
 *
 * `suggested` is the starter set, shown only when the project has no saved
 * rows of this type yet. Each entry is merged onto a blank item, so unlisted
 * fields take their defaults (unlinked, Standard, medium/medium for risks).
 */
export const LIST_CONFIG = {
  milestones: {
    key: 'milestones',
    table: 'project_milestones',
    step: 7,
    title: 'Programme',
    intro:
      'Set the milestones that mark real progress, and link each to the objective it serves. A milestone serving a non-negotiable objective is treated as critical.',
    itemNoun: 'milestone',
    addLabel: 'Add milestone',
    requiredField: 'name',
    fields: [
      {
        name: 'name',
        label: 'Milestone',
        type: 'text',
        full: true,
        placeholder: 'e.g. Planning approval secured',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'text',
        full: true,
        optional: true,
        placeholder: 'Optional detail.',
      },
      {
        name: 'target_date',
        label: 'Target date',
        type: 'date',
        optional: true,
      },
    ],
    suggested: [
      { name: 'Planning approval secured' },
      { name: 'Design finalised' },
      { name: 'Contractor appointed' },
      { name: 'Construction commenced' },
      { name: 'Practical completion' },
      { name: 'Handover complete' },
    ],
  },

  workstreams: {
    key: 'workstreams',
    table: 'project_workstreams',
    step: 5,
    title: 'Organisation and Governance',
    intro:
      'Define the workstreams that deliver the project and who leads each, and link a workstream to the objective it serves. A workstream serving a non-negotiable objective is treated as critical.',
    itemNoun: 'workstream',
    addLabel: 'Add workstream',
    requiredField: 'name',
    fields: [
      {
        name: 'name',
        label: 'Workstream',
        type: 'text',
        full: true,
        placeholder: 'e.g. Design and planning',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'text',
        full: true,
        optional: true,
        placeholder: 'Optional detail.',
      },
      {
        name: 'lead',
        label: 'Lead',
        type: 'text',
        optional: true,
        placeholder: 'Who leads this?',
      },
    ],
    suggested: [
      { name: 'Design and planning' },
      { name: 'Funding and finance' },
      { name: 'Construction delivery' },
      { name: 'Cost and commercial management' },
      { name: 'Sales and marketing' },
    ],
  },

  risks: {
    key: 'risks',
    table: 'project_risks',
    step: 8,
    title: 'Risks, Assumptions, Constraints and Dependencies',
    intro:
      'Capture the risks you can already see. Tag each to the objective it threatens, rate it, and note how you would respond.',
    itemNoun: 'risk',
    addLabel: 'Add risk',
    requiredField: 'description',
    fields: [
      {
        name: 'description',
        label: 'Risk',
        type: 'text',
        full: true,
        placeholder: 'e.g. Planning permission delayed or refused',
      },
      {
        name: 'likelihood',
        label: 'Likelihood',
        type: 'select',
        options: LIKELIHOOD_OPTIONS,
        default: 'medium',
      },
      {
        name: 'impact',
        label: 'Impact',
        type: 'select',
        options: IMPACT_OPTIONS,
        default: 'medium',
      },
      {
        name: 'mitigation',
        label: 'Mitigation',
        type: 'textarea',
        full: true,
        optional: true,
        placeholder: 'How would you respond?',
      },
    ],
    suggested: [
      { description: 'Planning permission delayed or refused' },
      { description: 'Construction costs exceed budget' },
      { description: 'Funding delayed or falls through' },
      { description: 'Programme slips beyond target completion' },
      { description: 'Sales slower than forecast' },
    ],
  },

  // The three RAID siblings alongside risks (step 8). Same shape as risks for
  // the cascade: a description (the identity field), an optional detail, the
  // link to the objective they bear on, and a criticality that cascades from
  // it. They reuse StepItemList and persistList unchanged. No suggested starter
  // set: the placeholders prompt the developer, and the lists start empty.
  assumptions: {
    key: 'assumptions',
    table: 'project_assumptions',
    step: 8,
    title: 'Assumptions',
    intro:
      'The assumptions the baseline rests on. Link each to the objective it bears on, so its weight follows from the objective it serves.',
    itemNoun: 'assumption',
    addLabel: 'Add assumption',
    requiredField: 'description',
    fields: [
      {
        name: 'description',
        label: 'Assumption',
        type: 'text',
        full: true,
        placeholder: 'e.g. Planning permission will be granted as designed',
      },
      {
        name: 'detail',
        label: 'Detail',
        type: 'text',
        full: true,
        optional: true,
        placeholder: 'Optional detail.',
      },
    ],
    suggested: [],
  },

  constraints: {
    key: 'constraints',
    table: 'project_constraints',
    step: 8,
    title: 'Constraints',
    intro: 'The fixed constraints the project must respect.',
    itemNoun: 'constraint',
    addLabel: 'Add constraint',
    requiredField: 'description',
    fields: [
      {
        name: 'description',
        label: 'Constraint',
        type: 'text',
        full: true,
        placeholder: 'e.g. Fixed completion date set by a funding condition',
      },
      {
        name: 'detail',
        label: 'Detail',
        type: 'text',
        full: true,
        optional: true,
        placeholder: 'Optional detail.',
      },
    ],
    suggested: [],
  },

  dependencies: {
    key: 'dependencies',
    table: 'project_dependencies',
    step: 8,
    title: 'Dependencies',
    intro: 'The external dependencies the project relies on to deliver.',
    itemNoun: 'dependency',
    nounPlural: 'dependencies',
    addLabel: 'Add dependency',
    requiredField: 'description',
    fields: [
      {
        name: 'description',
        label: 'Dependency',
        type: 'text',
        full: true,
        placeholder: 'e.g. Utilities connection by the network operator',
      },
      {
        name: 'detail',
        label: 'Detail',
        type: 'text',
        full: true,
        optional: true,
        placeholder: 'Optional detail.',
      },
    ],
    suggested: [],
  },
};

// Step number -> config, for the shell's render and save switch.
export const CONFIG_BY_STEP = {
  5: LIST_CONFIG.workstreams,
  7: LIST_CONFIG.milestones,
  8: LIST_CONFIG.risks,
};
