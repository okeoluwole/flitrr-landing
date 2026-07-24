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
 * unique per (project, objective_type). The critical-or-standard rule
 * itself (the always_critical flag and the non-negotiable test) now lives
 * once in the engine kernel (classifyByType); this module keeps only its
 * own knowledge of which objective_type a given play concerns.
 *
 * PROPOSALS ARE DERIVED (C1): plays for the project's current stage minus
 * the pairs in project_playbook_state. Accepted stays accepted, dismissed
 * stays dismissed; no re-nagging. Stage keying only (C6): no gate
 * mechanics here, so Stage 3 content stays dormant until projects can
 * reach Stage 3.
 */

import { classifyByType } from '../engine/criticality.js';

// Top-five cap (C4): a stage entry never dumps the full set at once; the
// rest sit behind one Show all tap.
export const PROPOSAL_CAP = 5;

/**
 * A play's derived criticality for a project. objectivesByType maps
 * objective_type -> { id, classification } from the project's own
 * project_objectives rows (the byType index the callers build with the
 * kernel's buildObjectiveIndex). A thin wrapper over the engine kernel (A5):
 * it defers the critical-or-standard decision to classifyByType, passing the
 * play's objective_type and its always_critical flag, so the one rule lives
 * in lib/engine. Returns 'critical' or 'standard' (the shared
 * criticality_level vocabulary). Name and signature are unchanged for its
 * caller (deriveProposals).
 */
export function derivePlayCriticality(play, objectivesByType) {
  return classifyByType(play.objective, objectivesByType, {
    alwaysCritical: play.always_critical,
  });
}

// The one objective classification that confers criticality, as the kernel
// names it. Read here only to word the basis line, never to decide anything.
const NON_NEGOTIABLE = 'non_negotiable';

/**
 * Why this play was put in front of this developer, in one line (Note 18).
 *
 * The selection has always been deterministic: a play surfaces when its stage
 * matches the project's current stage, and it reads critical when it is marked
 * always_critical or when the project's own objective of the play's type is
 * non-negotiable. None of that was visible. A curated suggestion with no stated
 * basis is indistinguishable from a guess, and a governance product cannot
 * afford to look like it is guessing. This states the basis; it changes nothing
 * about the mechanism, which was confirmed deterministic in Session A0.
 *
 *   always_critical      "Stage 2 playbook. It applies on every project at
 *                        this stage."
 *   objective must hold  "Stage 2 playbook, selected because Cost is
 *                        non-negotiable on this project."
 *   otherwise            "Stage 2 playbook, for this stage of your project."
 */
export function playBasis(proposal, objectivesByType) {
  const stagePart = `Stage ${proposal?.stage} playbook`;
  if (proposal?.alwaysCritical) {
    return `${stagePart}. It applies on every project at this stage.`;
  }
  const objective = proposal?.objective
    ? objectivesByType?.[proposal.objective]
    : null;
  const name = proposal?.objectiveName ?? null;
  if (name && objective?.classification === NON_NEGOTIABLE) {
    return `${stagePart}, selected because ${name} is non-negotiable on this project.`;
  }
  return `${stagePart}, for this stage of your project.`;
}

/**
 * The criticality an accepted play takes once the developer has CONFIRMED the
 * objective it serves (Note 18).
 *
 * A suggestion carries no criticality in the band, because criticality is
 * derived from an objective link and the developer has not yet agreed to one.
 * The chip a play wore before it was accepted was asserting a classification of
 * an item that did not exist. On Add, the developer confirms the link (the
 * play's own objective by default) and the criticality derives from THAT, by
 * the same cascade every hand-logged action uses. An always_critical play stays
 * critical whatever the link, because that is what the flag means: the play
 * carries its own floor, set by the framework rather than by this project.
 *
 * `cascade` is the caller's cascadeCriticality, so the write-time stamping rule
 * stays in the engine kernel and is not restated here.
 */
export function confirmedPlayCriticality(proposal, linkedObjectiveId, cascade) {
  if (proposal?.alwaysCritical) return 'critical';
  return cascade(linkedObjectiveId || null);
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
 *   nameByType       objective_type -> display name, for the basis line
 *
 * Returns [{ playId, slug, stage, title, why, objective, objectiveName,
 * alwaysCritical, criticality, linkedObjectiveId, basis }].
 *
 * alwaysCritical and basis are carried (Note 18) so the surface can state WHY
 * a play was selected without re-deriving the selection, and so the Add flow
 * can re-derive criticality against whatever objective the developer confirms.
 */
export function deriveProposals({
  plays,
  states,
  currentStage,
  type,
  objectivesByType,
  nameByType,
}) {
  const acted = new Set((states ?? []).map((s) => s.play_id));

  return (plays ?? [])
    .filter(
      (p) => p.type === type && p.stage === currentStage && !acted.has(p.id)
    )
    .map((p) => {
      const objectiveName = nameByType?.[p.objective] ?? null;
      const proposal = {
        playId: p.id,
        slug: p.slug,
        stage: p.stage,
        title: p.title,
        why: p.why,
        objective: p.objective,
        objectiveName,
        alwaysCritical: p.always_critical === true,
        criticality: derivePlayCriticality(p, objectivesByType),
        linkedObjectiveId: objectivesByType?.[p.objective]?.id ?? null,
      };
      return {
        ...proposal,
        basis: playBasis(proposal, objectivesByType),
      };
    })
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
 * Description is the play title, stage carried from the play (A3, for the
 * gate-readiness view), the play's why kept as the citable reason (A4, so the
 * knowledge survives acceptance), source columns carrying the play id.
 *
 * The objective link and the criticality now come from the developer's
 * CONFIRMATION (Note 18) rather than straight off the proposal: `confirmed` is
 * { linkedObjectiveId, criticality } from the Add flow. Omit it and the play's
 * own mapping is used, which is what it always did, so existing callers and
 * tests are unchanged.
 */
export function buildActionFromPlay(proposal, projectId, confirmed) {
  const linkedObjectiveId =
    confirmed?.linkedObjectiveId !== undefined
      ? confirmed.linkedObjectiveId
      : proposal.linkedObjectiveId;
  return {
    project_id: projectId,
    description: proposal.title,
    linked_objective_id: linkedObjectiveId || null,
    criticality: confirmed?.criticality ?? proposal.criticality,
    stage: proposal.stage,
    reason: proposal.why,
    source: 'playbook',
    source_id: proposal.playId,
  };
}

/**
 * Accept a risk play (C5): the project_risks row Add to register creates.
 * Name from the play title, likelihood and impact at the register's default
 * convention (medium, medium). last_reviewed_at stays null so the risk surfaces
 * as not yet reviewed, and status takes the table default (watching); from there
 * it behaves as any risk, including qualifying for the Action Log's queue.
 *
 * The objective link and criticality come from the developer's confirmation
 * (Note 18), as for an action play. The source columns (migration 032) record
 * that this risk came from a play rather than from the Brief, so the register's
 * queue can state its provenance instead of assuming it.
 */
export function buildRiskFromPlay(proposal, projectId, confirmed) {
  const linkedObjectiveId =
    confirmed?.linkedObjectiveId !== undefined
      ? confirmed.linkedObjectiveId
      : proposal.linkedObjectiveId;
  return {
    project_id: projectId,
    description: proposal.title,
    linked_objective_id: linkedObjectiveId || null,
    criticality: confirmed?.criticality ?? proposal.criticality,
    likelihood: 'medium',
    impact: 'medium',
    source: 'playbook',
    source_id: proposal.playId,
  };
}
