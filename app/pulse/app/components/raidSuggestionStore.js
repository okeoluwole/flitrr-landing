/**
 * RAID suggestion state store (Note 7).
 *
 * The read and write layer for what the developer has already done with each
 * PULSE Suggests candidate at Step 8 of initiation: added it into the project,
 * or dismissed it. Every answer ends here as a row in
 * project_raid_suggestion_state (migration 036).
 *
 * WHY THIS EXISTS. Dismiss cleared a card and wrote nothing, so every dismissed
 * suggestion returned on the next load, and the developer had no way to make one
 * stay gone. Add was covered only by the exact-text check the engine already
 * runs, which is right until the captured text is edited, at which point the
 * candidate reappears as though it had never been taken. Both are the same
 * missing thing: there was no RECORD of what the developer did with a candidate,
 * only an inference drawn from what the register says at this moment.
 *
 * IT MIRRORS THE PLAYBOOK'S OWN DEDUPE. project_playbook_state does exactly this
 * job for the curated plays on the Action Log and the Risk register, and 031's
 * comment already names it as the dedupe for suggestions. This is the same
 * pattern for the initiation-time RAID candidates, whose identifier is the
 * authored `key` constant on the library candidate rather than a row id.
 *
 * THE THREE RULES IT HOLDS.
 *
 *   1. AN ADD IS RECORDED ONLY AFTER THE CAPTURE SUCCEEDED. capturedSuggestionIds
 *      reads the candidate key off items that carry a database id and nothing
 *      else, so a suggestion whose capture never landed cannot suppress itself.
 *
 *   2. EVERY WRITE UPSERTS on (project_id, candidate_id), so a candidate that was
 *      dismissed and is later added updates its state rather than colliding with
 *      the unique constraint.
 *
 *   3. NO WRITE FAILS SILENTLY. Both functions return Supabase's { error } and
 *      every caller surfaces it. A swallowed error here would reproduce the
 *      original defect in a form nobody could see.
 *
 * The pure parts carry the rules and are unit tested in isolation; the two async
 * functions wrap them in the repo's Supabase convention, where the caller passes
 * its already-created client.
 */

// The two recorded answers (the raid_suggestion_state enum, migration 036).
export const RAID_SUGGESTION_STATES = Object.freeze({
  ADDED: 'added',
  DISMISSED: 'dismissed',
});

// The table, and the conflict target every write upserts on. Named here so the
// unique constraint and the code that relies on it cannot drift apart.
export const RAID_SUGGESTION_STATE_TABLE = 'project_raid_suggestion_state';
export const RAID_SUGGESTION_STATE_CONFLICT = 'project_id,candidate_id';

// The columns a state row carries, read in one place so every read stays in
// step. snake_case as the database holds them.
export const RAID_SUGGESTION_STATE_COLUMNS =
  'id, project_id, candidate_id, state, acted_at';

/**
 * One state row from one answer. Pure row shaping: no clock (acted_at is the
 * database's NOW() default) and no id invention, the convention
 * triageDecisionStore.triageDecisionRowFrom follows.
 */
export function raidSuggestionStateRow({ projectId, candidateId, state }) {
  if (!candidateId) throw new Error('A suggestion state row needs a candidate.');
  if (state !== RAID_SUGGESTION_STATES.ADDED && state !== RAID_SUGGESTION_STATES.DISMISSED) {
    throw new Error('A suggestion state row is either added or dismissed.');
  }
  return {
    project_id: projectId,
    candidate_id: candidateId,
    state,
  };
}

/**
 * The candidate keys a project has already answered, from its state rows. This
 * is what the engine suppresses on, and it deliberately does not distinguish
 * added from dismissed: both mean the developer has dealt with the candidate,
 * and both keep it out of the band. The stored state is the record of WHICH,
 * for the restore path Note 15 will design.
 */
export function actedCandidateIds(rows) {
  const out = new Set();
  for (const row of rows ?? []) {
    if (typeof row?.candidate_id === 'string' && row.candidate_id !== '') {
      out.add(row.candidate_id);
    }
  }
  return out;
}

/**
 * The candidate keys to record as added, from the items of one saved list.
 *
 * AN ITEM QUALIFIES ONLY WHEN IT CARRIES BOTH its client-only suggestion marker
 * and a database id. The id is the proof the capture insert succeeded, so this
 * is rule 1 above expressed as data: an item still waiting to be inserted, or
 * one whose insert failed, yields nothing and its candidate stays on offer.
 *
 * The marker survives for the life of the session, so a save that inserted the
 * item but failed to record its state writes the state on the next save rather
 * than losing it. The write upserts, so repeating it is a no-op.
 */
export function capturedSuggestionIds(items) {
  const out = [];
  for (const item of items ?? []) {
    if (item?._suggestionKey && item?.id) out.push(item._suggestionKey);
  }
  return [...new Set(out)];
}

/**
 * Load a project's recorded suggestion state. Returns { candidateIds, error }:
 * the set the engine suppresses on, and Supabase's error (null on success).
 */
export async function loadRaidSuggestionState(supabase, projectId) {
  const { data, error } = await supabase
    .from(RAID_SUGGESTION_STATE_TABLE)
    .select(RAID_SUGGESTION_STATE_COLUMNS)
    .eq('project_id', projectId);
  if (error) return { candidateIds: null, error };
  return { candidateIds: actedCandidateIds(data ?? []), error: null };
}

/**
 * Record one answer, or several at once. Returns { error }.
 *
 * Upserts on (project_id, candidate_id): a candidate dismissed and later added
 * updates its state rather than colliding, and re-recording the same answer is a
 * no-op. An empty list writes nothing and reports no error.
 */
export async function recordRaidSuggestionState(
  supabase,
  { projectId, candidateIds, state }
) {
  const ids = (Array.isArray(candidateIds) ? candidateIds : [candidateIds]).filter(
    Boolean
  );
  if (ids.length === 0) return { error: null };

  const rows = ids.map((candidateId) =>
    raidSuggestionStateRow({ projectId, candidateId, state })
  );
  const { error } = await supabase
    .from(RAID_SUGGESTION_STATE_TABLE)
    .upsert(rows, { onConflict: RAID_SUGGESTION_STATE_CONFLICT });
  return { error: error ?? null };
}
