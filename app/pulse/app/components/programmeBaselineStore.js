/**
 * Programme baseline store (Programme module Phase 2.2).
 *
 * The read and write layer for the frozen operational baseline. v1 is the
 * first row, written at lock; a re-baseline writes a new version (v2 and on)
 * and never edits an old one. The current baseline is the latest version, the
 * single row whose superseded_at is null, read wholesale with nothing
 * re-derived. This is the persistence behind set-up step 5 in the Programme
 * specification; the lock screen (Phase 2.3) calls this layer, and progress,
 * status and RAG (Phase 3) read the frozen programme this layer stores.
 *
 * Where it is stored, and why a new table:
 *   - The baseline is a versioned, immutable snapshot, in the spirit of the
 *     Brief's own locked snapshot (project_briefs), not a set of live rows
 *     that re-derive. The table programme_baselines (migration 020) holds one
 *     immutable row per version per project. The whole self-contained object
 *     from assembleProgramme (lib/engine/programmeAssembly.js) is frozen into
 *     the programme jsonb column and read back unchanged.
 *   - The one-current invariant (exactly one row per project has a null
 *     superseded_at) is held structurally by a partial unique index, and the
 *     atomic supersede-and-insert is a single database function
 *     (lock_programme_baseline), so a reader never sees zero or two current
 *     rows.
 *
 * What this layer does NOT do:
 *   - It does not lock the screen, review, or wire the assembly engine to a
 *     surface. That is Phase 2.3.
 *   - It computes no percent-complete, no RAG, no status, and it stores no RAG
 *     tolerance. Those are Phase 3, deliberately outside the frozen baseline.
 *   - It never re-derives a baseline at read. It freezes what it is given and
 *     reads it back.
 *
 * The pure decision logic (validateAssembledProgramme, nextBaselineVersion,
 * planBaselineWrite, and the small row helpers) carries the rules and is
 * unit-tested in isolation: computing the next version from the existing rows,
 * deciding v1 versus re-baseline, requiring the reason on a re-baseline, and
 * shaping the row. The three async functions wrap that in the repo's Supabase
 * convention: the caller passes its already-awaited client, and each returns
 * the row(s) alongside Supabase's { error } (null on error). The atomic write
 * is the lock_programme_baseline database function; the reason rule, the
 * version uniqueness and the one-current index are the structural backstops.
 */

// The columns a baseline row carries, read in one place so the reads stay in
// step. snake_case as the database holds them.
export const BASELINE_COLUMNS =
  'id, project_id, version, source_brief_id, locked_by, locked_at, programme, rebaseline_reason, superseded_at, created_at';

/**
 * A typed error from the pure write decision, so a caller can tell a malformed
 * programme from a missing re-baseline reason without string-matching. The two
 * codes are 'malformed_programme' and 'reason_required'.
 */
export class BaselineWriteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BaselineWriteError';
    this.code = code;
  }
}

/**
 * Validate that an object is a well-formed assembled programme, the output
 * shape of assembleProgramme: an object carrying a non-empty stages array,
 * each stage with a numeric stage, an activities array and a gate with a key,
 * and each activity with a key and a milestones array. Structural, not
 * exhaustive: enough to reject garbage before it is frozen into an immutable
 * record, not so strict it rejects a genuine assembly. Returns { ok } with a
 * reason when not ok.
 */
export function validateAssembledProgramme(programme) {
  if (!programme || typeof programme !== 'object' || Array.isArray(programme)) {
    return { ok: false, reason: 'the assembled programme must be an object' };
  }
  if (!Array.isArray(programme.stages) || programme.stages.length === 0) {
    return { ok: false, reason: 'the assembled programme must carry a non-empty stages array' };
  }
  for (const stage of programme.stages) {
    if (!stage || typeof stage !== 'object') {
      return { ok: false, reason: 'each stage must be an object' };
    }
    if (typeof stage.stage !== 'number') {
      return { ok: false, reason: 'each stage must carry a numeric stage' };
    }
    if (!Array.isArray(stage.activities)) {
      return { ok: false, reason: 'each stage must carry an activities array' };
    }
    if (
      !stage.gate ||
      typeof stage.gate !== 'object' ||
      typeof stage.gate.key !== 'string'
    ) {
      return { ok: false, reason: 'each stage must carry a gate with a key' };
    }
    for (const activity of stage.activities) {
      if (
        !activity ||
        typeof activity !== 'object' ||
        typeof activity.key !== 'string' ||
        !Array.isArray(activity.milestones)
      ) {
        return { ok: false, reason: 'each activity must carry a key and a milestones array' };
      }
    }
  }
  return { ok: true };
}

/**
 * The current baseline row in a set of a project's baseline rows: the one with
 * a null superseded_at, or null when there is none. Pure; the rows are passed
 * in. By the one-current invariant there is at most one.
 */
export function currentBaselineRow(rows) {
  for (const row of rows ?? []) {
    if (row && row.superseded_at == null) return row;
  }
  return null;
}

/**
 * The next version number from a project's existing baseline rows: 1 when
 * there are none, otherwise the highest version plus one. v1 and v2 give 3.
 */
export function nextBaselineVersion(rows) {
  let max = 0;
  for (const row of rows ?? []) {
    if (row && typeof row.version === 'number' && row.version > max) max = row.version;
  }
  return max + 1;
}

/**
 * Whether a write against these existing rows is a re-baseline (a current
 * baseline already exists) rather than the first baseline (v1).
 */
export function isRebaseline(rows) {
  return currentBaselineRow(rows) != null;
}

/**
 * Decide and shape a baseline write from the project's existing rows and the
 * lock inputs. Pure: no database, no clock. The single decision the async
 * write wraps.
 *
 *   existingRows      the project's baseline rows, each carrying at least
 *                     { version, superseded_at }
 *   programme         the assembled programme to freeze (assembleProgramme's output)
 *   sourceBriefId     the locked Brief (v0) this baseline was assembled from
 *   lockedBy          the user locking the baseline (may be null; the database
 *                     function defaults it to auth.uid())
 *   rebaselineReason  required and non-empty on a re-baseline; ignored on v1
 *
 * Returns the write plan { isRebaseline, version, sourceBriefId, lockedBy,
 * rebaselineReason, programme }. The reason is the trimmed reason on a
 * re-baseline and always null on v1 (the first baseline carries no reason).
 *
 * Throws BaselineWriteError('malformed_programme') when the programme is not
 * well-formed, and BaselineWriteError('reason_required') when a re-baseline is
 * attempted without a non-empty reason. Rejecting before the write keeps
 * garbage out of an immutable record.
 */
export function planBaselineWrite({
  existingRows,
  programme,
  sourceBriefId = null,
  lockedBy = null,
  rebaselineReason = null,
}) {
  const valid = validateAssembledProgramme(programme);
  if (!valid.ok) {
    throw new BaselineWriteError('malformed_programme', valid.reason);
  }

  const rebaseline = isRebaseline(existingRows);
  const version = nextBaselineVersion(existingRows);

  let reason = null;
  if (rebaseline) {
    const trimmed = rebaselineReason == null ? '' : String(rebaselineReason).trim();
    if (trimmed === '') {
      throw new BaselineWriteError(
        'reason_required',
        'a re-baseline reason is required'
      );
    }
    reason = trimmed;
  }
  // v1 carries no reason even if one was passed.

  return {
    isRebaseline: rebaseline,
    version,
    sourceBriefId: sourceBriefId ?? null,
    lockedBy: lockedBy ?? null,
    rebaselineReason: reason,
    programme,
  };
}

/**
 * Shape the arguments for the lock_programme_baseline database function from a
 * write plan and the project id. The atomic supersede-and-insert is the
 * function's; this just names the arguments it takes.
 */
export function baselineRpcArgs(projectId, plan) {
  return {
    p_project_id: projectId,
    p_version: plan.version,
    p_programme: plan.programme,
    p_source_brief_id: plan.sourceBriefId,
    p_locked_by: plan.lockedBy,
    p_rebaseline_reason: plan.rebaselineReason,
  };
}

/**
 * Write a baseline row: freeze the assembled programme as the next version for
 * a project. The async write half of the layer.
 *
 * Validates the programme before touching the database, reads the project's
 * existing baseline rows to decide v1 versus re-baseline and the next version,
 * then calls the lock_programme_baseline function for the atomic
 * supersede-and-insert. On a re-baseline a non-empty reason is required; the
 * prior current row's superseded_at is stamped in the same transaction as the
 * insert, so the one-current invariant always holds.
 *
 * Returns { baseline, error }: the written row on success, or a null baseline
 * with the error (a BaselineWriteError for a malformed programme or a missing
 * reason, otherwise Supabase's error).
 */
export async function writeProgrammeBaseline(
  supabase,
  { projectId, programme, sourceBriefId = null, lockedBy = null, rebaselineReason = null }
) {
  // Reject a malformed programme outright, before any database read.
  const valid = validateAssembledProgramme(programme);
  if (!valid.ok) {
    return { baseline: null, error: new BaselineWriteError('malformed_programme', valid.reason) };
  }

  // Read just the two decision fields off the project's baseline rows.
  const { data: rows, error: readErr } = await supabase
    .from('programme_baselines')
    .select('version, superseded_at')
    .eq('project_id', projectId);
  if (readErr) return { baseline: null, error: readErr };

  let plan;
  try {
    plan = planBaselineWrite({
      existingRows: rows ?? [],
      programme,
      sourceBriefId,
      lockedBy,
      rebaselineReason,
    });
  } catch (err) {
    return { baseline: null, error: err };
  }

  // The atomic supersede-and-insert is one database function, so the
  // one-current invariant holds with no window of zero or two current rows.
  const { data, error: rpcErr } = await supabase.rpc(
    'lock_programme_baseline',
    baselineRpcArgs(projectId, plan)
  );
  if (rpcErr) return { baseline: null, error: rpcErr };

  // The function returns the single inserted row; some PostgREST setups wrap a
  // single composite result in an array, so unwrap defensively.
  const baseline = Array.isArray(data) ? data[0] ?? null : data ?? null;
  return { baseline, error: null };
}

/**
 * Load a project's current baseline: the row with a null superseded_at,
 * returning the frozen programme wholesale with nothing re-derived. Returns
 * { baseline, error }, with a null baseline when the project has no baseline
 * yet.
 */
export async function loadCurrentProgrammeBaseline(supabase, projectId) {
  const { data, error } = await supabase
    .from('programme_baselines')
    .select(BASELINE_COLUMNS)
    .eq('project_id', projectId)
    .is('superseded_at', null)
    .maybeSingle();
  if (error) return { baseline: null, error };
  return { baseline: data ?? null, error: null };
}

/**
 * Load a project's baseline version history: every baseline row in version
 * order, current and superseded, for the audit trail. Returns
 * { baselines, error }.
 */
export async function loadProgrammeBaselineHistory(supabase, projectId) {
  const { data, error } = await supabase
    .from('programme_baselines')
    .select(BASELINE_COLUMNS)
    .eq('project_id', projectId)
    .order('version', { ascending: true });
  if (error) return { baselines: null, error };
  return { baselines: data ?? [], error: null };
}
