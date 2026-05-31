/**
 * Shared objective metadata for the PULSE initiation flow (Steps 3 and 4).
 *
 * One source of truth for:
 *   - the canonical order of the five objectives (Scope, Cost, Time,
 *     Quality, Funding), which matches the objective_type enum's
 *     declaration order and the order handle_new_project() seeds rows in;
 *   - their display names and one-line descriptions (framework Section 6,
 *     used verbatim);
 *   - the human labels for the two classifications.
 *
 * Imported by StepProjectObjectives, StepConstraintRanking, and the wizard
 * shell so the order and labels can never drift between them.
 */

export const OBJECTIVE_META = [
  {
    type: 'scope',
    name: 'Scope',
    description: 'What is being built, and to what extent.',
  },
  {
    type: 'cost',
    name: 'Cost',
    description: 'What it costs to deliver.',
  },
  {
    type: 'time',
    name: 'Time',
    description: 'When it must complete.',
  },
  {
    type: 'quality',
    name: 'Quality',
    description: 'The standard the result must meet.',
  },
  {
    type: 'funding',
    name: 'Funding',
    description:
      'The availability and security of the money that enables the project.',
  },
];

// Canonical objective_type order, derived from the metadata above.
export const OBJECTIVE_ORDER = OBJECTIVE_META.map((o) => o.type);

// Human labels for the objective_classification enum values.
export const CLASSIFICATION_LABELS = {
  non_negotiable: 'Non-negotiable',
  flexible: 'Flexible',
};
