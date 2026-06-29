/**
 * Programme milestone actuals store and combined met-points view (Programme
 * module Phase 3.3).
 *
 * The mutable counterpart to the frozen v1 baseline (Phase 2.2). It is the piece
 * that closes the loop with the two tracking engines: it produces the met-points
 * view both the percent-complete engine (3.1, lib/engine/programmeProgress.js)
 * and the RAG engine (3.2, lib/engine/programmeRAG.js) read. It does not compute
 * progress or status; it stores which milestones are met and stitches them with
 * gate-met into the single map those engines consume.
 *
 * TWO SOURCES, ONE KEYSPACE. A milestone is met when this store holds a row for
 * it; a gate is met when the existing gate mechanic recorded it passed. The view
 * is the faithful stitch of the two:
 *   - The milestone actuals from programme_milestone_actuals (migration 021), the
 *     mutable record of met milestones, keyed by the milestone's stable point key.
 *   - The met gates from project_stage_gates, the gate mechanic's own record:
 *     gate_status = 'passed' means met, passed_at carries the date, and the stage
 *     integer (0..7) maps one to one onto the baseline's gate_<stage> key. No
 *     second record of gate-met is created here; the view reads what the mechanic
 *     already holds.
 * Milestone keys and gate keys share one keyspace and never collide, so they sit
 * in one map keyed exactly as the baseline keys its points.
 *
 * KEYED TO THE MILESTONE, NOT A BASELINE VERSION. The store keys actuals by the
 * milestone identifier and does not validate them against any baseline. The view
 * returns everything met for the project, not filtered to a baseline, because the
 * engines iterate the baseline and ignore any key it does not contain. So an
 * actual rides through a re-baseline untouched, and a record for a point a later
 * baseline no longer holds is simply ignored. Surfacing only real milestones to
 * mark is the UI's job, a later sub-step.
 *
 * THE SHAPE. Following the repo's persistence convention (programmeBaselineStore,
 * programmeChoices): the pure view assembly and the small helpers carry the logic
 * and are unit-tested in isolation, and the async functions are thin wrappers that
 * take the caller's already-awaited Supabase client and return the data alongside
 * Supabase's { error } (null on error). The mark-or-amend write is the
 * record_milestone_actual database function (migration 021), one atomic upsert
 * that preserves the original audit stamp on amendment.
 *
 * WHAT THIS LAYER DOES NOT DO. No tracking UI and no screen for marking a
 * milestone met (a later sub-step). No percent-complete and no RAG; this produces
 * the view those engines read, it does not compute them. No second record of
 * gate-met and no change to the gate mechanic. No baseline mutation.
 */

// The columns a milestone actual row carries, read in one place so the reads stay
// in step. snake_case as the database holds them.
export const MILESTONE_ACTUAL_COLUMNS =
  'id, project_id, milestone_key, met_date, recorded_by, recorded_at, updated_at';

// The gate-met fields read off project_stage_gates. The view needs only whether
// each gate is passed, the date it was passed, and which stage it closes; it
// writes nothing back, so the gate mechanic is untouched.
const GATE_MET_COLUMNS = 'stage, gate_status, passed_at';

// The gate_status value that means a gate is met. The gate mechanic sets
// gate_status to 'passed' at the go decision (migration 008); any other status
// (not_started, in_progress) means the gate is not yet met.
export const GATE_PASSED_STATUS = 'passed';

/**
 * The point key for a stage's gate, the same convention the baseline uses
 * (`gate_<stage>`), so a gate read from project_stage_gates by its stage integer
 * joins straight to the baseline's gate key. Mirrors programmeAssembly's gateKey,
 * the reality check and the reconcile resolutions; they all key a gate this way.
 */
export function gatePointKey(stage) {
  return `gate_${stage}`;
}

/**
 * Whether a gate row from the gate mechanic counts as met: its gate_status is
 * 'passed'. A gate not yet passed is simply absent from the view, exactly as the
 * engines expect (a point not in the map is not met).
 */
export function isGateMet(gateRow) {
  return gateRow?.gate_status === GATE_PASSED_STATUS;
}

/**
 * Build the combined met-points view the engines consume, from the milestone
 * actual rows and the gate rows. Pure and deterministic: it stitches the two
 * sources faithfully and invents nothing.
 *
 *   actualRows  the project's milestone actuals (programme_milestone_actuals),
 *               each carrying { milestone_key, met_date, ... }
 *   gateRows    the project's gate rows (project_stage_gates), each carrying
 *               { stage, gate_status, passed_at }
 *
 * Returns a plain object keyed by the point id (milestone keys and gate keys in
 * one keyspace), each met point in the canonical contract shape
 * { met: true, metDate }, the exact shape programmeProgress.js and
 * programmeRAG.js read. A met milestone carries its met_date; a met gate carries
 * its passed_at where the mechanic records one. Only met points appear: an unmet
 * milestone has no row and a gate not passed is skipped, so it is absent from the
 * view. The view is not filtered to any baseline; the engines ignore keys a
 * baseline does not contain.
 */
export function buildMetPointsView(actualRows, gateRows) {
  const view = {};

  for (const row of actualRows ?? []) {
    if (row == null || row.milestone_key == null) continue;
    view[row.milestone_key] = { met: true, metDate: row.met_date ?? null };
  }

  for (const row of gateRows ?? []) {
    if (row == null || row.stage == null) continue;
    if (!isGateMet(row)) continue;
    view[gatePointKey(row.stage)] = { met: true, metDate: row.passed_at ?? null };
  }

  return view;
}

/**
 * Shape the arguments for the record_milestone_actual database function. The
 * atomic mark-or-amend upsert is the function's; this just names the arguments it
 * takes. recordedBy may be null, in which case the function defaults it to
 * auth.uid().
 */
export function actualRpcArgs(projectId, milestoneKey, metDate, recordedBy = null) {
  return {
    p_project_id: projectId,
    p_milestone_key: milestoneKey,
    p_met_date: metDate,
    p_recorded_by: recordedBy ?? null,
  };
}

/**
 * Mark a milestone met, or amend its met date if it already was. The async write
 * half of the layer.
 *
 * One atomic upsert via record_milestone_actual: it inserts the row if the
 * milestone was not yet met (stamping who recorded it and when), and updates the
 * met date if it was, preserving the original audit stamp and bumping the
 * last-updated timestamp. Binary: met if and only if a row exists.
 *
 * Returns { actual, error }: the written row on success, or a null actual with
 * the error. A missing milestone key or met date is rejected before the write,
 * so a malformed mark never reaches the database.
 */
export async function markMilestoneMet(
  supabase,
  { projectId, milestoneKey, metDate, recordedBy = null }
) {
  if (typeof milestoneKey !== 'string' || milestoneKey.trim() === '') {
    return { actual: null, error: new Error('a milestone key is required') };
  }
  if (
    metDate == null ||
    (typeof metDate === 'string' && metDate.trim() === '')
  ) {
    return { actual: null, error: new Error('a met date is required') };
  }

  const { data, error } = await supabase.rpc(
    'record_milestone_actual',
    actualRpcArgs(projectId, milestoneKey, metDate, recordedBy)
  );
  if (error) return { actual: null, error };

  // The function returns the single upserted row; some PostgREST setups wrap a
  // single composite result in an array, so unwrap defensively.
  const actual = Array.isArray(data) ? data[0] ?? null : data ?? null;
  return { actual, error: null };
}

/**
 * Un-mark a milestone: delete its actual row. Binary, met if and only if a row
 * exists, so the un-mark is a plain delete. A milestone that was not met deletes
 * nothing and is not an error. Returns { error }.
 */
export async function unmarkMilestone(supabase, { projectId, milestoneKey }) {
  const { error } = await supabase
    .from('programme_milestone_actuals')
    .delete()
    .eq('project_id', projectId)
    .eq('milestone_key', milestoneKey);
  return { error: error ?? null };
}

/**
 * Load a project's milestone actuals: every met-milestone row. Returns
 * { actuals, error }, with an empty array when the project has none.
 */
export async function loadMilestoneActuals(supabase, projectId) {
  const { data, error } = await supabase
    .from('programme_milestone_actuals')
    .select(MILESTONE_ACTUAL_COLUMNS)
    .eq('project_id', projectId);
  if (error) return { actuals: null, error };
  return { actuals: data ?? [], error: null };
}

/**
 * Load a project's gate rows from the existing gate mechanic, for the met-gates
 * side of the view. A read only; it never writes to project_stage_gates. Returns
 * { gates, error }, the eight seeded stage rows (0..7) for a project, in stage
 * order.
 */
export async function loadGateMetRows(supabase, projectId) {
  const { data, error } = await supabase
    .from('project_stage_gates')
    .select(GATE_MET_COLUMNS)
    .eq('project_id', projectId)
    .order('stage', { ascending: true });
  if (error) return { gates: null, error };
  return { gates: data ?? [], error: null };
}

/**
 * Load the combined met-points view for a project: the single map the engines
 * read. Reads the milestone actuals and the gate rows together and stitches them
 * with buildMetPointsView. Returns { view, error }.
 */
export async function loadMetPointsView(supabase, projectId) {
  const [actualsRes, gatesRes] = await Promise.all([
    loadMilestoneActuals(supabase, projectId),
    loadGateMetRows(supabase, projectId),
  ]);
  if (actualsRes.error) return { view: null, error: actualsRes.error };
  if (gatesRes.error) return { view: null, error: gatesRes.error };
  return {
    view: buildMetPointsView(actualsRes.actuals, gatesRes.gates),
    error: null,
  };
}
