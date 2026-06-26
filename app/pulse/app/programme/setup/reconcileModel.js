/**
 * The reconcile-decision helper (Programme module Phase 1.2). The pure logic
 * behind the reconcile-dates screen: given the reality-check engine's output
 * (lib/engine/programmeRealityCheck.js, deriveRealityCheck) it determines which
 * dated points the developer must decide on, which decisions each tier allows,
 * the date each decision agrees, when the developer may proceed, and the
 * resolution set the screen emits on proceed.
 *
 * Pure and deterministic: no DB, no React, no clock. It reads the engine result
 * and the developer's per-item decisions, and computes. The screen is a thin
 * render over this helper, so correctness lives here, not in the component.
 *
 * What it does NOT do. It does not re-run or change the engine. It never reads
 * the advised date: an accepted propose agrees the engine's recommended date,
 * not the gateWeeks advised date, and the screen never presents the advised date
 * as a competing third date on a row. It persists nothing. Phase 2 assembly
 * (sub-step 2.1) applies the resolution set over the loaded programme; this step
 * only produces it.
 *
 * THE TIERS AND THE DECISIONS THEY ALLOW (specification Section 7):
 *   - within_norm. Not flagged. Never shown and never decided. Its date carries
 *     forward unchanged and it is not in the resolution set.
 *   - propose. Two even-handed choices. ACCEPTED agrees the engine's
 *     recommendedDate. KEPT agrees the developer's own date and records the
 *     reason for the divergence; a kept divergence becomes a recorded risk
 *     later, so a reason is required before the developer may proceed.
 *   - force. A breached confirmed hard floor. ACCEPTED only: it agrees the
 *     floor-compliant recommendedDate. It cannot be kept, and an undecided force
 *     blocks proceed.
 *   - flag_verify. A soft jurisdiction prompt, neither a block nor a
 *     recommendation. VERIFIED only: the developer acknowledges they have
 *     checked, an optional note may be given, and it keeps the developer's own
 *     date. It does not block proceed the way a force does.
 *
 * THE DECISION STATE the screen holds, keyed by the item's key (gate keys are
 * `gate_<stage>`, milestone keys are the template's stable keys, and the two
 * never collide, so a key is unique across the result):
 *   { [item.key]: { decision: 'accepted' | 'kept' | 'verified' | null, note: string } }
 * `note` carries the keep reason (required) or the verify note (optional). It is
 * unused for an accepted decision.
 */

import { RECONCILE_TIERS } from '../../../../../lib/engine/programmeRealityCheck.js';

// The decisions a developer can record on a flagged item. These are the values
// the resolution set carries, and they map one to one onto the screen's
// actions: accept gives accepted, keep gives kept, acknowledge gives verified.
export const RECONCILE_DECISIONS = Object.freeze({
  ACCEPTED: 'accepted',
  KEPT: 'kept',
  VERIFIED: 'verified',
});

const { ACCEPTED, KEPT, VERIFIED } = RECONCILE_DECISIONS;

/**
 * The flagged items the screen shows, in the engine's order. within_norm items
 * are silent: they are excluded here, raise no prompt, and their dates carry
 * forward unchanged. The screen renders only propose, force and flag_verify.
 */
export function flaggedItems(realityCheck) {
  return (realityCheck?.items ?? []).filter(
    (it) => it && it.tier !== RECONCILE_TIERS.WITHIN_NORM
  );
}

/**
 * The decisions a flagged item's tier permits. propose is even-handed (accept
 * or keep); force is accept only (it cannot be kept); flag_verify is verified
 * only (acknowledge). Anything else, a within_norm item or an unknown tier,
 * permits nothing.
 */
export function allowedDecisions(item) {
  switch (item?.tier) {
    case RECONCILE_TIERS.PROPOSE:
      return [ACCEPTED, KEPT];
    case RECONCILE_TIERS.FORCE:
      return [ACCEPTED];
    case RECONCILE_TIERS.FLAG_VERIFY:
      return [VERIFIED];
    default:
      return [];
  }
}

/**
 * A kept divergence is a recorded risk later, so the developer must say why they
 * are holding their date. Centralised so the screen and the proceed gate agree
 * on what a keep needs. Accept and verify need only the decision itself.
 */
export function decisionNeedsReason(decision) {
  return decision === KEPT;
}

/**
 * The date a decision agrees for an item:
 *   accepted -> the engine's recommendedDate, never the advised date
 *   kept     -> the developer's own date
 *   verified -> the developer's own date (flag_verify keeps it)
 * Returns null for an item with no decision. An accepted decision returns null
 * only if the item carries no recommendation, which does not occur for a propose
 * or a force (the engine always sets recommendedDate on both).
 */
export function agreedDate(item, decision) {
  if (!item) return null;
  if (decision === ACCEPTED) return item.recommendedDate ?? null;
  if (decision === KEPT) return item.developerDate ?? null;
  if (decision === VERIFIED) return item.developerDate ?? null;
  return null;
}

/**
 * Is this item's decision complete enough to proceed on? The decision must be
 * one the tier allows, and a keep must carry a non-empty reason. Accept and
 * verify need only the decision. An undecided item (decision null) is never
 * valid, which is what blocks proceed on an unresolved force.
 */
export function isDecisionValid(item, state) {
  const decision = state?.decision ?? null;
  if (!allowedDecisions(item).includes(decision)) return false;
  if (decisionNeedsReason(decision)) {
    return typeof state?.note === 'string' && state.note.trim() !== '';
  }
  return true;
}

/**
 * May the developer proceed? Only when every flagged item has a valid decision:
 * every propose accepted or kept-with-reason, every force accepted, every
 * flag_verify acknowledged. With nothing flagged this is trivially true, so the
 * skip path proceeds straight through.
 */
export function canProceed(realityCheck, decisions) {
  return flaggedItems(realityCheck).every((it) =>
    isDecisionValid(it, decisions?.[it.key])
  );
}

/**
 * The empty decision state for a reality check: one entry per flagged item, with
 * no decision chosen and no note. There is no default selection, so the screen
 * never nudges toward accept or keep, and a flag_verify must be explicitly
 * acknowledged rather than passing silently.
 */
export function initialDecisions(realityCheck) {
  const out = {};
  for (const it of flaggedItems(realityCheck)) {
    out[it.key] = { decision: null, note: '' };
  }
  return out;
}

/**
 * A small tally for the screen footer and tests: how many dated points were
 * flagged (propose plus force plus flag_verify), how many sat within range, and
 * the per-tier counts. Read straight off the engine's counts.
 */
export function reconcileSummary(realityCheck) {
  const counts = realityCheck?.counts ?? {};
  const withinNorm = counts[RECONCILE_TIERS.WITHIN_NORM] ?? 0;
  const propose = counts[RECONCILE_TIERS.PROPOSE] ?? 0;
  const force = counts[RECONCILE_TIERS.FORCE] ?? 0;
  const flagVerify = counts[RECONCILE_TIERS.FLAG_VERIFY] ?? 0;
  return {
    flagged: propose + force + flagVerify,
    withinNorm,
    propose,
    force,
    flagVerify,
  };
}

/**
 * The resolution set emitted on proceed: one resolution per flagged item, in the
 * engine's order, for the assembly step (2.1) to apply over the loaded
 * programme. within_norm items are not in the set; their dates carry forward
 * unchanged. Pure: it maps the current decisions, and the screen gates the
 * proceed on canProceed.
 *
 * Per item: the milestone or gate key, the kind, the stage, the tier, the
 * developer's date, the recommended date where one exists, the agreed date, the
 * decision (accepted, kept or verified), and the note where one was given.
 */
export function buildResolutions(realityCheck, decisions) {
  return flaggedItems(realityCheck).map((it) => {
    const state = decisions?.[it.key] ?? {};
    const decision = state.decision ?? null;
    // Only a kept or verified decision carries a note (the keep reason, or the
    // verify note). An accepted decision never does, so a stale note left in the
    // screen's state, for example a keep reason typed before the developer
    // switched to accept, is dropped here rather than emitted on the resolution.
    const carriesNote = decision === KEPT || decision === VERIFIED;
    const note =
      carriesNote && typeof state.note === 'string' && state.note.trim() !== ''
        ? state.note.trim()
        : null;
    return {
      key: it.key,
      kind: it.kind,
      stage: it.stage,
      tier: it.tier,
      developerDate: it.developerDate ?? null,
      recommendedDate: it.recommendedDate ?? null,
      agreedDate: agreedDate(it, decision),
      decision,
      note,
    };
  });
}
