/**
 * Playbook model (M7.4). Pure, deterministic proposal logic shared by the
 * Action Log (action plays) and the Risk register (risk plays). No DB, no
 * React, no network: every input is passed in, so the same inputs always
 * give the same proposals and the whole module is unit-testable in
 * isolation.
 *
 * THE CRITICALITY DERIVATION (M7.4 spec, C3). A play surfaces as critical
 * for a project when always_critical is true, OR when the project's own
 * objective matching the play's objective is classified non-negotiable.
 * Otherwise standard. This is cascading classification applied to curated
 * content: the same play is critical on one project and standard on
 * another, by the developer's own Brief. The map is deterministic from the
 * schema: play.objective is an objective_type, and project_objectives is
 * unique per (project, objective_type).
 *
 * PROPOSALS ARE DERIVED (C1): plays for the project's current stage minus
 * the pairs in project_playbook_state. Accepted stays accepted, dismissed
 * stays dismissed; no re-nagging. Stage keying only (C6): no gate
 * mechanics here, so Stage 3 content stays dormant until projects can
 * reach Stage 3.
 */

// Top-five cap (C4): a stage entry never dumps the full set at once; the
// rest sit behind one Show all tap.
export const PROPOSAL_CAP = 5;

/**
 * A play's derived criticality for a project. objectivesByType maps
 * objective_type -> { id, classification } from the project's own
 * project_objectives rows. Returns 'critical' or 'standard' (the shared
 * criticality_level vocabulary).
 */
export function derivePlayCriticality(play, objectivesByType) {
  if (play.always_critical === true) return 'critical';
  const objective = objectivesByType?.[play.objective];
  return objective?.classification === 'non_negotiable'
    ? 'critical'
    : 'standard';
}

/**
 * Derive the live proposals for one surface. Filters plays to the wanted
 * type and the project's current stage, drops every play already acted on
 * (accepted or dismissed), derives each survivor's criticality and its
 * linked objective id, and sorts derived-criticality first. Ties keep
 * their incoming order (pass plays in a stable order; the pages order by
 * slug).
 *
 *   plays            playbook_plays rows
 *   states           project_playbook_state rows for the project
 *   currentStage     projects.current_stage
 *   type             'action' (the log) or 'risk' (the register)
 *   objectivesByType objective_type -> { id, classification }
 *
 * Returns [{ playId, slug, stage, title, why, objective, criticality,
 * linkedObjectiveId }].
 */
export function deriveProposals({
  plays,
  states,
  currentStage,
  type,
  objectivesByType,
}) {
  const acted = new Set((states ?? []).map((s) => s.play_id));

  return (plays ?? [])
    .filter(
      (p) => p.type === type && p.stage === currentStage && !acted.has(p.id)
    )
    .map((p) => ({
      playId: p.id,
      slug: p.slug,
      stage: p.stage,
      title: p.title,
      why: p.why,
      objective: p.objective,
      criticality: derivePlayCriticality(p, objectivesByType),
      linkedObjectiveId: objectivesByType?.[p.objective]?.id ?? null,
    }))
    .sort((a, b) => {
      const ca = a.criticality === 'critical' ? 0 : 1;
      const cb = b.criticality === 'critical' ? 0 : 1;
      return ca - cb;
    });
}

/**
 * The top-five split (C4): the band shows `top`; `rest` sits behind Show
 * all. With PROPOSAL_CAP or fewer proposals, rest is empty and no Show all
 * renders.
 */
export function splitProposals(proposals, cap = PROPOSAL_CAP) {
  const list = proposals ?? [];
  return { top: list.slice(0, cap), rest: list.slice(cap) };
}

/**
 * Accept an action play (C4): the project_actions row Add to log creates.
 * Description is the play title, objective mapped, criticality derived, stage
 * carried from the play (A3, for the gate-readiness view), source columns
 * carrying the play id.
 */
export function buildActionFromPlay(proposal, projectId) {
  return {
    project_id: projectId,
    description: proposal.title,
    linked_objective_id: proposal.linkedObjectiveId,
    criticality: proposal.criticality,
    stage: proposal.stage,
    source: 'playbook',
    source_id: proposal.playId,
  };
}

/**
 * Accept a risk play (C5): the project_risks row Add to register creates.
 * Name from the play title, objective mapped, criticality derived,
 * likelihood and impact at the register's default convention (medium,
 * medium). last_reviewed_at stays null so the risk surfaces as not yet
 * reviewed, and status takes the table default (watching); from there it
 * behaves as any risk, including qualifying for the needs-your-response
 * band.
 */
export function buildRiskFromPlay(proposal, projectId) {
  return {
    project_id: projectId,
    description: proposal.title,
    linked_objective_id: proposal.linkedObjectiveId,
    criticality: proposal.criticality,
    likelihood: 'medium',
    impact: 'medium',
  };
}
