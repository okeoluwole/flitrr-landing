/**
 * Weekly digest model (M7.3, made proportional in A6). Pure, deterministic
 * selection and grouping logic for the digest job. No DB, no network, no
 * system clock: every input is passed in, so the same inputs always give the
 * same digest and the whole module is unit-testable (the route supplies the
 * data and the time).
 *
 * THE NOTIFICATION RULE (M7.3 B1, A6). Out-of-app email is reserved for the
 * must-hold work: open tracked actions (status not done) whose LIVE criticality
 * is critical, derived from the objective they serve and any downward override
 * (the shared isCritical in lib/engine/readiness.js), not the stored snapshot.
 * Raw risk flags and pushed items never email; they stay in app. isDigestAction
 * is that rule, in one place, reusing the same engine criticality the log reads
 * so the two can never disagree.
 *
 * PROPORTIONAL, NOT FLAT (A6). The digest is led by what bears on the must-hold
 * objectives and the gate each project is working toward: every project section
 * carries its stage and a gate-readiness line, and within a project the actions
 * bearing on the current gate lead. Loud for must-hold, silent for the rest (a
 * project with no must-hold action is dropped, and a user whose digest comes
 * back empty is not emailed at all).
 */

import {
  isCritical,
  isDone,
  actionStage,
  gateReadiness,
} from '../engine/readiness.js';

// Lifecycle stage names (framework Section 4), for the gate framing. Mirrors
// the workspace and the log.
const STAGE_NAMES = {
  0: 'Land and Site Acquisition',
  1: 'Project Objectives and Funding',
  2: 'Consultant Appointment',
  3: 'Design and Planning Approvals',
  4: 'Contractor Procurement',
  5: 'Construction',
  6: 'Completion and Handover',
  7: 'Sales and Disposal',
};
const LAST_STAGE = 7;

// The gate a stage works toward, named by its destination, guarded for the
// final stage where there is no onward gate.
function gateLabel(stage) {
  const next = stage + 1;
  return next <= LAST_STAGE
    ? `the gate into Stage ${next}`
    : `the close of Stage ${stage}`;
}

// The notification rule (A6): open and live-critical. Reuses the log's
// criticality so the digest and the log never disagree about what must hold.
export function isDigestAction(action, objectivesById) {
  return !isDone(action) && isCritical(action, objectivesById);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The run key for a moment in time: the date (YYYY-MM-DD) of the Monday of
 * its UTC week. The scheduled run is weekly (Monday 06:00 UTC), so every
 * trigger within the same Monday-to-Sunday week shares one key, and the
 * UNIQUE (user_id, run_key) constraint on digest_sends makes a second send
 * within that week impossible, however the route is re-triggered.
 *
 * now: epoch milliseconds, passed in by the caller.
 */
export function digestRunKey(now) {
  const d = new Date(now);
  // getUTCDay: 0 Sunday .. 6 Saturday. Days back to Monday: Mon 0 .. Sun 6.
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d.getTime() - daysSinceMonday * MS_PER_DAY);
  return monday.toISOString().slice(0, 10);
}

/**
 * Who receives this run: users who have the digest on and have not already
 * been sent this run's email. profiles rows carry digest_enabled;
 * alreadySentIds is the set of user ids recorded in digest_sends for this
 * run_key. Whether each recipient actually gets an email is then the
 * digest's own call (empty means silent).
 */
export function filterRecipients(profiles, alreadySentIds) {
  const sent = alreadySentIds ?? new Set();
  return (profiles ?? []).filter(
    (p) => p.digest_enabled === true && !sent.has(p.id)
  );
}

/**
 * Build one user's digest from their projects and the candidate actions.
 * Applies the live notification rule (isDigestAction), groups by project,
 * drops projects with no must-hold action, and frames each kept project by its
 * stage and the gate it is working toward (the gate-readiness counts over its
 * open actions). Orders deterministically: projects by name; within a project,
 * the actions bearing on the current gate first, then oldest first.
 *
 * objectivesById: objective id -> { classification, name }, supplied by the
 * caller. classification drives the live criticality; name is the display
 * name. A digest action is always linked to a non-negotiable objective, so it
 * carries that objective's name.
 *
 * Returns { projects: [{ id, name, stage, stageName, gateLabel, gate: { open,
 * critical }, actions: [{ description, objectiveName }] }], totalCount }.
 * totalCount 0 means send nothing.
 */
export function buildUserDigest(projects, actions, objectivesById) {
  const byId = objectivesById ?? {};
  const grouped = [];

  for (const project of projects ?? []) {
    const stage = project.current_stage;
    const projectActions = (actions ?? []).filter(
      (a) => a.project_id === project.id
    );

    const own = projectActions
      .filter((a) => isDigestAction(a, byId))
      .sort((a, b) => compareDigestActions(a, b, stage))
      .map((a) => ({
        description: a.description,
        objectiveName: a.linked_objective_id
          ? byId[a.linked_objective_id]?.name ?? null
          : null,
      }));

    if (own.length === 0) continue;

    const gate = gateReadiness(projectActions, byId, stage);
    grouped.push({
      id: project.id,
      name: project.name,
      stage,
      stageName: STAGE_NAMES[stage] ?? `Stage ${stage}`,
      gateLabel: gateLabel(stage),
      gate: { open: gate.open, critical: gate.critical },
      actions: own,
    });
  }

  grouped.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  return {
    projects: grouped,
    totalCount: grouped.reduce((n, p) => n + p.actions.length, 0),
  };
}

// Order within a project: the actions bearing on the current gate first (the
// approaching gate leads), then oldest first (the longest-standing commitments).
function compareDigestActions(a, b, stage) {
  const ga = actionStage(a, stage) === stage ? 0 : 1;
  const gb = actionStage(b, stage) === stage ? 0 : 1;
  if (ga !== gb) return ga - gb;
  return parseTime(a.created_at) - parseTime(b.created_at);
}

// Oldest first; missing or unparseable timestamps sort last, so a partial row
// can never throw or lead the list.
function parseTime(iso) {
  if (!iso) return Number.MAX_SAFE_INTEGER;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}
