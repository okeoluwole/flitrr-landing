/**
 * Weekly digest model (M7.3). Pure, deterministic selection and grouping
 * logic for the digest job. No DB, no network, no system clock: every input
 * is passed in, so the same inputs always give the same digest and the whole
 * module is unit-testable in isolation (the route supplies the data and the
 * time).
 *
 * THE LOCKED NOTIFICATION RULE (M7.3 spec, B1). Out-of-app email is reserved
 * for committed critical actions: open tracked actions (status not done)
 * with criticality critical. Raw risk flags and pushed items never email;
 * they stay in app. isDigestAction is that rule, in one place.
 *
 * The digest only speaks when there is something to say: a user whose
 * digest comes back empty (totalCount 0) is not emailed at all.
 */

// The locked rule: open and critical, nothing else.
export function isDigestAction(action) {
  return action.status !== 'done' && action.criticality === 'critical';
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
 * Applies the locked rule (isDigestAction), groups by project, drops
 * projects with nothing to say, and orders deterministically: projects by
 * name, actions oldest first (the longest-standing commitments lead).
 *
 * objectiveNamesById: objective id -> display name (Scope, Cost, ...),
 * supplied by the caller; an unlinked action carries objectiveName null.
 *
 * Returns { projects: [{ id, name, actions: [{ description,
 * objectiveName }] }], totalCount }. totalCount 0 means send nothing.
 */
export function buildUserDigest(projects, actions, objectiveNamesById) {
  const namesById = objectiveNamesById ?? {};
  const grouped = [];

  for (const project of projects ?? []) {
    const own = (actions ?? [])
      .filter((a) => a.project_id === project.id && isDigestAction(a))
      .sort((a, b) => compareCreated(a, b))
      .map((a) => ({
        description: a.description,
        objectiveName: a.linked_objective_id
          ? namesById[a.linked_objective_id] ?? null
          : null,
      }));

    if (own.length > 0) {
      grouped.push({ id: project.id, name: project.name, actions: own });
    }
  }

  grouped.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  return {
    projects: grouped,
    totalCount: grouped.reduce((n, p) => n + p.actions.length, 0),
  };
}

// Oldest first; missing or unparseable timestamps sort last, so a partial
// row can never throw or lead the list.
function compareCreated(a, b) {
  return parseTime(a.created_at) - parseTime(b.created_at);
}

function parseTime(iso) {
  if (!iso) return Number.MAX_SAFE_INTEGER;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}
