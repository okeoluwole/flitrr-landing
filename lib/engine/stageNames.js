/**
 * The eight lifecycle stage names, and the label a stage chip renders.
 *
 * The Flitrr Framework numbers its stages 0 to 7, so "Stage 1 of 8" invites the
 * reader to work out which of two numbering schemes is in play and answers
 * neither question a developer actually has. The label names the stage instead:
 * its own number and its own name, taken verbatim from the framework.
 *
 * Names are framework canon (the Eight Stage Mandates). This module is the
 * canonical source for them; it derives nothing and decides nothing, so it
 * carries no governance logic of its own.
 */

export const STAGE_NAMES = {
  0: 'Land and Site Acquisition',
  1: 'Project Objectives and Funding',
  2: 'Consultant Appointment',
  3: 'Design and Planning Approvals',
  4: 'Contractor Procurement',
  5: 'Construction',
  6: 'Completion and Handover',
  7: 'Sales and Disposal',
};

// The stages, in lifecycle order, for anything that needs to walk them.
export const STAGE_ORDER = [0, 1, 2, 3, 4, 5, 6, 7];

/**
 * The stage's own name, or null when the stage is not one of the eight.
 */
export function stageName(stage) {
  return STAGE_NAMES[stage] ?? null;
}

/**
 * The stage chip's label: "Stage 1: Project Objectives and Funding".
 *
 * A numeric string reads as its number, because the wizard holds the stage as a
 * string for its controlled select. A stage outside 0 to 7 falls back to the
 * bare "Stage N" rather than inventing a name. Anything unreadable returns null,
 * so a caller renders nothing rather than "Stage undefined".
 *
 * Absent input is unreadable, never Stage 0. Number(null) and Number('') are
 * both 0, so a missing stage would otherwise silently label itself Land and
 * Site Acquisition, which is the one wrong answer that looks right.
 */
export function stageLabel(stage) {
  if (stage == null || stage === '') return null;
  const n = Number(stage);
  if (!Number.isInteger(n)) return null;
  const name = STAGE_NAMES[n];
  return name ? `Stage ${n}: ${name}` : `Stage ${n}`;
}
