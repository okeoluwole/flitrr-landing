/**
 * Brief completeness gate (M3.6).
 *
 * A deterministic check, run on the wizard's current state, that decides
 * whether the brief may be LOCKED. Drafting and the live preview stay
 * permissive exactly as before: this gate sits on the lock action only,
 * nowhere else. Pure rules, no AI.
 *
 * Returns:
 *   - canLock: true only when every required item is satisfied.
 *   - required:    the spine that blocks the lock, each { key, group, label,
 *                  ok, detail? }.
 *   - recommended: items shown but never blocking, each { key, label, ok,
 *                  detail?, note? }.
 *
 * Field mapping is grounded in the wizard state and briefModel:
 *   - identity, financials -> def (Step 1)
 *   - strategic narrative  -> ctx.strategic_rationale (Step 2), the prose that
 *                             leads the verbatim part of the executive summary
 *   - objectives           -> objectives[] (objective_type, classification,
 *                             definition, tolerance)
 *   - ranking              -> the live rankOrder (always the source of truth
 *                             for order; the persisted rank column can lag a
 *                             same-session reorder, so it is not used here)
 *   - lists                -> lists.milestones / workstreams / risks, keyed on
 *                             the same identity field the brief uses to drop
 *                             blank rows (name, name, description)
 *
 * Notes on two required checks that are structurally always satisfied by the
 * time the brief renders, kept as real (defensive) checks rather than dropped:
 *   - "all five classified": classification is never null (it defaults to
 *     flexible), so this passes whenever the five objective rows are present.
 *   - "ranking complete": rankOrder always holds all five once Step 4 is
 *     reached, which is required to reach the brief.
 * The meaningful objective gate is therefore the definitions, and the
 * meaningful list gate is at least one named milestone, workstream and risk.
 */

const OBJECTIVE_COUNT = 5;

// A value is present when it is a non-empty string after trimming. Mirrors
// the brief's own normaliser so the gate agrees with what the brief renders.
function present(v) {
  return v != null && String(v).trim() !== '';
}

// Whether any item in a list has its identity field filled (the same rule the
// brief uses to keep a row).
function hasNamed(items, field) {
  return (items ?? []).some((it) => present(it[field]));
}

export function checkCompleteness({
  def,
  ctx,
  objectives,
  rankOrder,
  lists,
} = {}) {
  const objs = objectives ?? [];
  const milestones = lists?.milestones ?? [];
  const workstreams = lists?.workstreams ?? [];
  const risks = lists?.risks ?? [];

  // ── Required (these block the lock) ──────────────────────────────────────

  const allClassified =
    objs.length === OBJECTIVE_COUNT &&
    objs.every(
      (o) =>
        o.classification === 'non_negotiable' || o.classification === 'flexible'
    );

  const definedCount = objs.filter((o) => present(o.definition)).length;
  const allDefined =
    objs.length === OBJECTIVE_COUNT && definedCount === OBJECTIVE_COUNT;

  const ranked =
    Array.isArray(rankOrder) && rankOrder.length === OBJECTIVE_COUNT;

  const required = [
    { key: 'name', group: 'Project identity', label: 'Project name', ok: present(def?.name) },
    { key: 'type', group: 'Project identity', label: 'Project type', ok: present(def?.project_type) },
    { key: 'location', group: 'Project identity', label: 'Location', ok: present(def?.location) },
    { key: 'size', group: 'Project identity', label: 'Size', ok: present(def?.size) },
    {
      key: 'completion',
      group: 'Project identity',
      label: 'Target completion date',
      ok: present(def?.target_completion_date),
    },
    {
      key: 'context',
      group: 'Strategic context',
      label: 'Strategic context narrative',
      ok: present(ctx?.strategic_rationale),
    },
    {
      key: 'classified',
      group: 'Objectives',
      label: 'All five objectives classified',
      ok: allClassified,
    },
    {
      key: 'defined',
      group: 'Objectives',
      label: 'A definition for all five objectives',
      ok: allDefined,
      detail: allDefined ? null : `${definedCount} of ${OBJECTIVE_COUNT} defined`,
    },
    {
      key: 'ranked',
      group: 'Constraints',
      label: 'Objectives ranked by priority',
      ok: ranked,
    },
    {
      key: 'milestone',
      group: 'Milestones, workstreams and risks',
      label: 'At least one milestone',
      ok: hasNamed(milestones, 'name'),
    },
    {
      key: 'workstream',
      group: 'Milestones, workstreams and risks',
      label: 'At least one workstream',
      ok: hasNamed(workstreams, 'name'),
    },
    {
      key: 'risk',
      group: 'Milestones, workstreams and risks',
      label: 'At least one risk',
      ok: hasNamed(risks, 'description'),
    },
  ];

  // ── Recommended (shown, never blocking) ──────────────────────────────────

  const realMilestones = milestones.filter((m) => present(m.name));
  const realWorkstreams = workstreams.filter((w) => present(w.name));
  const flexible = objs.filter((o) => o.classification === 'flexible');

  const leadsAssigned = realWorkstreams.filter((w) => present(w.lead)).length;
  const datesSet = realMilestones.filter((m) => present(m.target_date)).length;
  const tolerancesSet = flexible.filter((o) => present(o.tolerance)).length;

  const financialsEntered = [
    present(def?.budget),
    present(def?.projected_gdv),
    present(def?.projected_roi),
  ].filter(Boolean).length;

  const recommended = [
    {
      key: 'leads',
      label: 'Workstream leads',
      ok: realWorkstreams.length === 0 || leadsAssigned === realWorkstreams.length,
      detail:
        realWorkstreams.length === 0
          ? null
          : `${leadsAssigned} of ${realWorkstreams.length} assigned`,
      note: 'Usually assigned at consultant appointment (Stage 2).',
    },
    {
      key: 'milestoneDates',
      label: 'Milestone target dates',
      ok: realMilestones.length === 0 || datesSet === realMilestones.length,
      detail:
        realMilestones.length === 0
          ? null
          : `${datesSet} of ${realMilestones.length} set`,
    },
    {
      key: 'financials',
      label: 'Budget and projections',
      ok: financialsEntered === 3,
      detail: `${financialsEntered} of 3 entered`,
    },
    {
      key: 'appraisal',
      label: 'Full appraisal link',
      ok: present(def?.financial_detail_url),
    },
    {
      key: 'tolerances',
      label: 'Tolerance bounds on flexible objectives',
      ok: flexible.length === 0 || tolerancesSet === flexible.length,
      detail:
        flexible.length === 0
          ? null
          : `${tolerancesSet} of ${flexible.length} set`,
    },
  ];

  const canLock = required.every((r) => r.ok);

  return { canLock, required, recommended };
}
