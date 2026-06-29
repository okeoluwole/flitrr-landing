/**
 * The review-and-lock helper (Programme module Phase 2.3). The pure logic behind
 * the screen that closes the set-up arc: it filters the assembled programme down
 * to what the developer reviews, decides whether a fresh lock is allowed, shapes
 * the arguments for the v1 baseline write, and reads a write result. The screen
 * is a thin render over this helper, so correctness lives here, not in the
 * component.
 *
 * Pure and deterministic: no DB, no React, no clock. It reads the assembled
 * programme (lib/engine/programmeAssembly.js, assembleProgramme) and plain inputs,
 * and computes. It writes nothing itself: the async write is the store's
 * (programmeBaselineStore.writeProgrammeBaseline), and this helper only shapes its
 * arguments and reads its result.
 *
 * What it does NOT do. It does not assemble (that is 2.1) and it does not persist
 * (that is 2.2). It never edits a date: the review is read-only, the reality check
 * having run upstream. It locks v1 only and never produces a re-baseline; the
 * re-baseline reason is always null here.
 *
 * THE VISIBILITY FILTER, the load-bearing rule. The review shows the gates and the
 * carried milestones, the ones the developer dated in the Brief, with their
 * baseline dates, stage by stage. The added milestones, the engine's derived
 * drill-down points, are written into v1 as part of the assembled programme but
 * are not shown on this review: the commitment the developer reviews is about the
 * points they decided. The carried-versus-added tag the assembly engine bakes
 * (ITEM_ORIGIN) is what distinguishes them. reviewStages keeps the gates and the
 * carried milestones and drops the added ones; the assembled programme the store
 * freezes is untouched and still carries every point.
 *
 * THE FLOW PHASES this screen lives in, extending the 1.2 reconcile flow:
 *   - reconcile. The 1.2 step, present only when a date was flagged.
 *   - review. The read-only assembled programme, with the lock action.
 *   - confirmed. The post-lock landing, reached only on a successful write.
 * The clean-skip case, where nothing was flagged, has no reconcile step, so the
 * flow opens straight on review and there is no reconcile to step back to.
 */

import { ITEM_ORIGIN } from '../../../../../lib/engine/programmeAssembly.js';

// The flow's phases. The reconcile step is the 1.2 screen; review is this step's
// read-only programme; confirmed is the post-lock landing. Frozen so a caller
// cannot mutate the vocabulary.
export const REVIEW_PHASES = Object.freeze({
  RECONCILE: 'reconcile',
  REVIEW: 'review',
  CONFIRMED: 'confirmed',
});

/**
 * The phase the flow opens on. When a date was flagged the developer reconciles
 * first; when nothing was flagged the reconcile step is skipped entirely and the
 * flow opens straight on the review.
 */
export function initialReviewPhase(anyFlagged) {
  return anyFlagged ? REVIEW_PHASES.RECONCILE : REVIEW_PHASES.REVIEW;
}

/**
 * Whether the review can step back to reconcile. Only where there was a reconcile
 * step, that is, where a date was flagged. In the clean-skip case there is no
 * reconcile to return to. Changing a date the developer set themselves, which was
 * never flagged, is a Brief-level action and is not offered on this screen.
 */
export function canReturnToReconcile(anyFlagged) {
  return anyFlagged === true;
}

// Order two dated points by their baseline date, undated points first. Used to
// read each stage's milestones in chronological order on the review.
function byBaselineDate(a, b) {
  const ta = a?.baselineDate instanceof Date ? a.baselineDate.getTime() : 0;
  const tb = b?.baselineDate instanceof Date ? b.baselineDate.getTime() : 0;
  return ta - tb;
}

// A plain copy of an assembled milestone for the review, carrying only the fields
// the screen reads. The criticality and the served objective are baked by the
// assembly engine, never derived here, so nothing about a classification is
// invented at render time.
function reviewMilestone(milestone) {
  return {
    key: milestone.key,
    name: milestone.name,
    serves: milestone.serves,
    criticality: milestone.criticality,
    baselineDate: milestone.baselineDate ?? null,
    origin: milestone.origin,
  };
}

/**
 * The review's stage-by-stage view of the assembled programme: each stage with
 * its carried milestones (the developer's own dated points, sorted by date) and
 * its gate. The added drill-down milestones are filtered out here; they remain in
 * the assembled programme the store freezes. A not-applicable stage carries no
 * dated points and is marked so the screen can render it plainly.
 *
 * The gate is always kept, dated or not. A gate carries no baked criticality (the
 * assembly engine bakes criticality on milestones only), so the review shows a
 * gate's date but never a gate criticality it would have to invent.
 */
export function reviewStages(assembled) {
  return (assembled?.stages ?? []).map((stage) => {
    const carried = [];
    for (const activity of stage.activities ?? []) {
      for (const milestone of activity.milestones ?? []) {
        if (milestone && milestone.origin === ITEM_ORIGIN.CARRIED) {
          carried.push(reviewMilestone(milestone));
        }
      }
    }
    carried.sort(byBaselineDate);
    return {
      stage: stage.stage,
      name: stage.name,
      applicable: stage.applicable !== false,
      stageStart: stage.stageStart ?? null,
      gate: {
        key: stage.gate?.key ?? `gate_${stage.stage}`,
        name: stage.gate?.name ?? stage.name,
        baselineDate: stage.gate?.baselineDate ?? null,
        origin: stage.gate?.origin ?? ITEM_ORIGIN.CARRIED,
      },
      milestones: carried,
    };
  });
}

/**
 * A small tally for the review footer and tests: the dated gates and the carried
 * milestones shown, and the added drill-down milestones hidden from the review but
 * written into v1. The added count is read straight off the assembled programme,
 * the same object the store freezes, so the footer can state plainly what locks
 * silently.
 */
export function reviewSummary(assembled) {
  const stages = reviewStages(assembled);
  let gates = 0;
  let carriedMilestones = 0;
  for (const stage of stages) {
    if (stage.gate && stage.gate.baselineDate) gates += 1;
    carriedMilestones += stage.milestones.length;
  }
  let addedMilestones = 0;
  for (const stage of assembled?.stages ?? []) {
    for (const activity of stage.activities ?? []) {
      for (const milestone of activity.milestones ?? []) {
        if (milestone && milestone.origin === ITEM_ORIGIN.ADDED) addedMilestones += 1;
      }
    }
  }
  return { gates, carriedMilestones, addedMilestones };
}

/**
 * Whether a fresh v1 lock is allowed. This screen locks v1 only, so it is lockable
 * only when the project has no current baseline. A current baseline (passed in as
 * the row, or any lightweight token of it) means it is already locked, and the
 * screen shows the already-locked state instead of offering a second lock.
 * Re-baselining a locked programme is a separate, later flow, out of scope here.
 *
 * Returns { lockable, reason }: reason is 'already_locked' when a current baseline
 * exists, and null when lockable.
 */
export function lockEligibility(currentBaseline) {
  if (currentBaseline) {
    return { lockable: false, reason: 'already_locked' };
  }
  return { lockable: true, reason: null };
}

/**
 * The convenience boolean over lockEligibility, for a screen guard.
 */
export function isLockable(currentBaseline) {
  return lockEligibility(currentBaseline).lockable;
}

/**
 * Shape the arguments for the v1 baseline write (programmeBaselineStore
 * .writeProgrammeBaseline) from the lock inputs:
 *   assembled      the assembled programme to freeze (assembleProgramme's output),
 *                  written whole, drill-down milestones and all
 *   projectId      the project the baseline belongs to
 *   sourceBriefId  the v0 provenance reference: the locked Brief the set-up was
 *                  entered from
 *   lockedBy       the current user locking the baseline
 *
 * The re-baseline reason is always null: this screen locks the first baseline,
 * never a re-baseline. The store derives v1 from the absence of prior rows.
 */
export function buildBaselineLockArgs({
  assembled,
  projectId,
  sourceBriefId = null,
  lockedBy = null,
}) {
  return {
    projectId,
    programme: assembled,
    sourceBriefId: sourceBriefId ?? null,
    lockedBy: lockedBy ?? null,
    rebaselineReason: null,
  };
}

/**
 * Whether a store write result means the lock succeeded: a written baseline row
 * and no error. A failed write yields no confirmation, so the screen advances to
 * the confirmed phase only when this is true.
 */
export function lockSucceeded(result) {
  return Boolean(result && result.error == null && result.baseline != null);
}

/**
 * The phase to land on after a lock attempt: confirmed on a successful write, and
 * the review otherwise, so a failed write leaves the developer on the review with
 * the programme still unlocked rather than claiming a lock that did not happen.
 */
export function phaseAfterLock(result) {
  return lockSucceeded(result) ? REVIEW_PHASES.CONFIRMED : REVIEW_PHASES.REVIEW;
}
