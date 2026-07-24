/**
 * Triage decision store (Notes 18 and 19).
 *
 * The read and write layer for the decision a developer records on every queued
 * item: the Critical Brief items awaiting triage on the Action Log, and the
 * PULSE Suggests plays on both the log and the Risk register. Every outcome
 * ends here as a row in project_triage_decisions (migration 031), carrying what
 * was decided, on what, who decided, when, and, for a decline, why.
 *
 * WHY THIS EXISTS. The queue had two responses, Track this and Review in
 * register, and no way to say no. An item the developer had read, considered
 * and rejected looked exactly like one they had never opened, so the queue
 * could only grow and nothing recorded that a judgement had been made. A
 * governance surface that cannot record a decline is not recording decisions at
 * all; it is recording only the ones that happened to create work.
 *
 * IT REUSES THE PATTERN 029 SET (reconcileDecisionStore.js). A triage decision
 * is a governance decision on a Brief item, so it is recorded the way a
 * reconcile decision is: an append-only row naming the decision, its decider
 * and its timestamp, with the reason required where the decision needs one. The
 * pure parts (row shaping, the latest-per-item read, the declined set) carry
 * the rules and are unit tested in isolation; the two async functions wrap them
 * in the repo's Supabase convention, where the caller passes its already-created
 * client and each returns its rows alongside Supabase's { error }.
 *
 * APPEND ONLY. One row per decision event. Re-deciding an item appends a new
 * row and the current decision is the latest by decided_at; nothing is edited
 * and nothing is deleted, so the history of what was decided and when survives.
 *
 * WHAT project_playbook_state STILL DOES. It stays the dedupe for suggestions,
 * one row per project and play, which is what keeps an accepted or dismissed
 * play from returning. It records acted_at but has no actor and is not append
 * only. The two are written together: the state row makes the suggestion stay
 * gone, this row records who decided that and why.
 */

// The four recorded outcomes (the triage_decision enum, migration 031).
export const TRIAGE_DECISIONS = Object.freeze({
  TRACKED: 'tracked',
  DISMISSED: 'dismissed',
  ADDED: 'added',
  REVIEWED: 'reviewed',
});

// Where a decision was taken. A play is offered on both surfaces, so the record
// says which one the developer answered it on.
export const TRIAGE_SURFACES = Object.freeze({
  ACTION_LOG: 'action_log',
  RISK_REGISTER: 'risk_register',
});

// The five queued item kinds (the item_kind check, migration 031).
export const TRIAGE_ITEM_KINDS = Object.freeze({
  RISK: 'risk',
  ASSUMPTION: 'assumption',
  CONSTRAINT: 'constraint',
  DEPENDENCY: 'dependency',
  PLAY: 'play',
});

// The columns a decision row carries, read in one place so every read stays in
// step. snake_case as the database holds them.
export const TRIAGE_COLUMNS =
  'id, project_id, item_kind, item_id, item_name, surface, decision, reason, created_action_id, created_risk_id, decided_by, decided_at';

/**
 * The stable key for one queued item across the five tables it might live in.
 * The kind is part of the key because ids are only unique within their own
 * table, and the feed mixes all five.
 */
export function itemKey(kind, id) {
  return `${kind}:${id}`;
}

// An ISO timestamp as epoch milliseconds, 0 when missing or unparseable, so the
// latest-wins comparison below never throws on a partial row.
function epoch(iso) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * The latest decision per item from a set of rows, the current decision on each.
 * Append-only means an item can carry several rows; the newest by decided_at
 * wins, with the incoming row order as the tiebreak so the result is
 * deterministic on identical timestamps. Pure; the rows are passed in.
 */
export function latestDecisionsByItem(rows) {
  const byKey = new Map();
  for (const row of rows ?? []) {
    if (row == null || row.item_id == null || row.item_kind == null) continue;
    const key = itemKey(row.item_kind, row.item_id);
    const held = byKey.get(key);
    if (held == null || epoch(row.decided_at) >= epoch(held.decided_at)) {
      byKey.set(key, row);
    }
  }
  return byKey;
}

/**
 * The set of item keys the developer has declined: the items whose LATEST
 * decision is a dismiss. Latest, not any, so an item dismissed and later
 * tracked returns to being tracked rather than staying suppressed by its own
 * history. This is what the queue filters by, and it is the only way an item
 * leaves the queue without creating work.
 */
export function dismissedItemKeys(rows) {
  const out = new Set();
  for (const [key, row] of latestDecisionsByItem(rows)) {
    if (row.decision === TRIAGE_DECISIONS.DISMISSED) out.add(key);
  }
  return out;
}

/**
 * One decision row from one decision. Pure row shaping: no clock (decided_at is
 * the database's NOW() default) and no id invention, the convention
 * reconcileDecisionStore.decisionRowFrom follows.
 *
 * A dismiss carries its reason, trimmed. The database enforces this too
 * (triage_decisions_dismiss_reason); the check here is so a missing reason
 * fails at the call site with something readable rather than as a constraint
 * violation.
 */
export function triageDecisionRowFrom({
  projectId,
  itemKind,
  itemId,
  itemName = null,
  surface,
  decision,
  reason = null,
  createdActionId = null,
  createdRiskId = null,
  decidedBy = null,
}) {
  const clean = typeof reason === 'string' ? reason.trim() : null;
  if (decision === TRIAGE_DECISIONS.DISMISSED && !clean) {
    throw new Error('A dismissed item needs a reason.');
  }
  return {
    project_id: projectId,
    item_kind: itemKind,
    item_id: itemId,
    item_name: itemName ?? null,
    surface,
    decision,
    reason: clean === '' ? null : clean,
    created_action_id: createdActionId,
    created_risk_id: createdRiskId,
    decided_by: decidedBy ?? null,
  };
}

/**
 * Load a project's recorded triage decisions, newest first. Returns
 * { decisions, error }. The queue reads this to drop the items already
 * declined.
 */
export async function loadTriageDecisions(supabase, projectId) {
  const { data, error } = await supabase
    .from('project_triage_decisions')
    .select(TRIAGE_COLUMNS)
    .eq('project_id', projectId)
    .order('decided_at', { ascending: false });
  if (error) return { decisions: null, error };
  return { decisions: data ?? [], error: null };
}

/**
 * Record one triage decision. Returns { decision, error }: the written row, and
 * Supabase's error (null on success).
 *
 * The caller does the work first and records second, the same order
 * recordReconcileDecisions uses for its verification actions: the tracked
 * action or the added risk is created, then its id rides onto this row, so the
 * record and the thing it produced stay tied. A decision whose recording fails
 * is surfaced rather than swallowed, because a decision that was made must not
 * be silently lost.
 */
export async function recordTriageDecision(supabase, input) {
  const row = triageDecisionRowFrom(input);
  const { data, error } = await supabase
    .from('project_triage_decisions')
    .insert(row)
    .select(TRIAGE_COLUMNS)
    .single();
  if (error) return { decision: null, error };
  return { decision: data ?? null, error: null };
}

// The decision vocabulary in words, one label per outcome, kept here so the
// record and any rendering of it cannot drift.
export const TRIAGE_DECISION_LABEL = Object.freeze({
  tracked: 'Tracked as an action',
  dismissed: 'Dismissed, with the reason recorded',
  added: 'Added',
  reviewed: 'Opened in the register for review',
});
