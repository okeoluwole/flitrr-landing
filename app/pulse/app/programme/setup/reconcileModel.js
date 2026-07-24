/**
 * The reconcile-decision helper (Programme module Phase 1.2, widened to one
 * decision grammar by Note 14). The pure logic behind the reconcile-dates
 * screen: given the reality-check engine's output
 * (lib/engine/programmeRealityCheck.js, deriveRealityCheck) it determines which
 * dated points the developer must decide on, which decisions each tier allows,
 * the date each decision agrees, when the developer may proceed, what is
 * blocking them when they may not, and the resolution set the screen emits on
 * proceed.
 *
 * Pure and deterministic: no DB, no React, no clock. It reads the engine result
 * and the developer's per-item decisions, and computes. The screen is a thin
 * render over this helper, so correctness lives here, not in the component.
 *
 * What it does NOT do. It does not re-run or change the engine. It never reads
 * the advised date: an accepted propose agrees the engine's recommended date,
 * not the gateWeeks advised date, and the screen never presents the advised date
 * as a competing third date on a row. It persists nothing: the decision records
 * and the open verification actions are written by reconcileDecisionStore.js
 * from the plan this file builds. Phase 2 assembly (sub-step 2.1) applies the
 * resolution set over the loaded programme.
 *
 * ONE DECISION GRAMMAR (Note 14). Every flagged date ends in a RECORDED
 * decision. Before this, a VERIFY LOCALLY card was attest-only, a checkbox that
 * covered one outcome of three and left no trace; a developer who had not
 * checked, or who knew the date was wrong, had nowhere to say so. The five
 * decisions:
 *   - ACCEPTED  the engine's recommended date is agreed
 *   - KEPT      the developer's own date is held, with a required reason; the
 *               tracked optimism, recorded as a risk downstream
 *   - AMENDED   neither offered date is right, so the developer sets the
 *               operational date here. The locked Brief is NEVER mutated: the
 *               amend is a recorded variance from the Brief's target, which is
 *               exactly what the lock-time reconciliation check reads as
 *               explained rather than as a blocking mismatch
 *   - VERIFIED  the attestation: checked locally, with an optional note. Who
 *               and when ride on the record
 *   - DEFERRED  verify later. The flow proceeds on the developer's own date and
 *               an open verification action is raised on the Action Log, so
 *               nothing is silently waved through
 *
 * THE TIERS AND THE DECISIONS THEY ALLOW (specification Section 7, widened):
 *   - within_norm. Not flagged. Never shown and never decided. Its date carries
 *     forward unchanged and it is not in the resolution set.
 *   - propose. The recommendation card: accept, keep with a reason, or amend to
 *     a third date when neither offered date is right.
 *   - force. A breached confirmed hard floor. Accept, or amend to another
 *     floor-compliant date. It can never be KEPT, and an amend below the floor
 *     is refused, so the hard-floor mechanic is untouched by the widening.
 *   - flag_verify. A soft jurisdiction prompt that refuses to invent a
 *     jurisdictional number, so it carries no recommendation and can never be
 *     ACCEPTED. Confirm (verified), amend, or verify later (deferred).
 *
 * THE DECISION STATE the screen holds, keyed by the item's key (gate keys are
 * `gate_<stage>`, milestone keys are the template's stable keys, and the two
 * never collide, so a key is unique across the result):
 *   { [item.key]: { decision, note, amendedDate } }
 * `note` carries the keep reason (required), the amend reason (optional) or the
 * verify note (optional). `amendedDate` is the ISO date an amend sets, and is
 * unused by every other decision.
 */

import { RECONCILE_TIERS } from '../../../../../lib/engine/programmeRealityCheck.js';

// The decisions a developer can record on a flagged item. These are the values
// the resolution set and the decision record carry, and they map one to one
// onto the screen's actions.
export const RECONCILE_DECISIONS = Object.freeze({
  ACCEPTED: 'accepted',
  KEPT: 'kept',
  AMENDED: 'amended',
  VERIFIED: 'verified',
  DEFERRED: 'deferred',
});

const { ACCEPTED, KEPT, AMENDED, VERIFIED, DEFERRED } = RECONCILE_DECISIONS;

// One day in milliseconds, for the floor comparison below.
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Soft parse to epoch milliseconds, or null. The engine hands Dates, the screen
 * hands the ISO string an <input type="date"> produces, and a stored record
 * hands a date string back. All three read the same way here.
 */
export function softEpoch(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    const epoch = value.getTime();
    return Number.isNaN(epoch) ? null : epoch;
  }
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const epoch = Date.parse(trimmed);
    return Number.isNaN(epoch) ? null : epoch;
  }
  return null;
}

// A Date at the value's instant, or null. Kept local so the model never invents
// a date of its own.
function toDate(value) {
  const epoch = softEpoch(value);
  return epoch == null ? null : new Date(epoch);
}

// The YYYY-MM-DD form an <input type="date"> takes and a DATE column stores.
// UTC, like every other date the engines produce, so the day never shifts with
// the viewer's timezone.
export function toDateInputValue(value) {
  const epoch = softEpoch(value);
  if (epoch == null) return '';
  return new Date(epoch).toISOString().slice(0, 10);
}

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
 * The decisions a flagged item's tier permits (Note 14). Every tier now offers
 * an amend, because "neither of these two dates is right" is a real answer that
 * previously had nowhere to go. What each tier refuses is unchanged: a force can
 * never be kept, and a flag_verify can never be accepted, because there is no
 * recommendation to accept. Anything else, a within_norm item or an unknown
 * tier, permits nothing.
 */
export function allowedDecisions(item) {
  switch (item?.tier) {
    case RECONCILE_TIERS.PROPOSE:
      return [ACCEPTED, KEPT, AMENDED];
    case RECONCILE_TIERS.FORCE:
      return [ACCEPTED, AMENDED];
    case RECONCILE_TIERS.FLAG_VERIFY:
      return [VERIFIED, AMENDED, DEFERRED];
    default:
      return [];
  }
}

/**
 * A kept divergence is a recorded risk later, so the developer must say why they
 * are holding their date. Centralised so the screen and the proceed gate agree
 * on what a keep needs. Every other decision needs only the decision itself; an
 * amend needs a date, not a reason, so a developer correcting an obvious slip is
 * not forced to write prose about it.
 */
export function decisionNeedsReason(decision) {
  return decision === KEPT;
}

/**
 * An amend sets the operational date, so it must carry one.
 */
export function decisionNeedsDate(decision) {
  return decision === AMENDED;
}

/**
 * The date a decision agrees for an item:
 *   accepted -> the engine's recommendedDate, never the advised date
 *   kept     -> the developer's own date
 *   amended  -> the date the developer set here
 *   verified -> the developer's own date (the attestation keeps it)
 *   deferred -> the developer's own date (the flow proceeds, the check is owed)
 * Returns null for an item with no decision. An accepted decision returns null
 * only if the item carries no recommendation, which does not occur for a propose
 * or a force (the engine always sets recommendedDate on both).
 */
export function agreedDate(item, decision, state) {
  if (!item) return null;
  if (decision === ACCEPTED) return item.recommendedDate ?? null;
  if (decision === AMENDED) return toDate(state?.amendedDate);
  if (decision === KEPT || decision === VERIFIED || decision === DEFERRED) {
    return item.developerDate ?? null;
  }
  return null;
}

/**
 * Is an amended date acceptable for this item? The hard-floor mechanic survives
 * the widening: a force was flagged because the developer's date fell below a
 * confirmed requirement, so an amend must land on or after the floor-compliant
 * recommended date. Every other tier accepts any date the developer sets, since
 * the point of the amend is that PULSE has no better number to offer.
 *
 * Returns { ok, reason }: reason is 'missing' with no date, 'below_floor' when a
 * force amend breaches its floor, and null when the date is fine.
 */
export function checkAmendedDate(item, state) {
  const epoch = softEpoch(state?.amendedDate);
  if (epoch == null) return { ok: false, reason: 'missing' };
  if (item?.tier === RECONCILE_TIERS.FORCE) {
    const floorEpoch = softEpoch(item.recommendedDate);
    // Whole-day tolerance: the two sides are UTC-midnight instants, so this
    // compares days, never a sub-day drift in either direction.
    if (floorEpoch != null && epoch < floorEpoch - MS_PER_DAY / 2) {
      return { ok: false, reason: 'below_floor' };
    }
  }
  return { ok: true, reason: null };
}

/**
 * Is this item's decision complete enough to proceed on? The decision must be
 * one the tier allows, a keep must carry a non-empty reason, and an amend must
 * carry a date the tier accepts. An undecided item (decision null) is never
 * valid, which is what blocks proceed on an unresolved force.
 */
export function isDecisionValid(item, state) {
  const decision = state?.decision ?? null;
  if (!allowedDecisions(item).includes(decision)) return false;
  if (decisionNeedsReason(decision)) {
    return typeof state?.note === 'string' && state.note.trim() !== '';
  }
  if (decisionNeedsDate(decision)) {
    return checkAmendedDate(item, state).ok;
  }
  return true;
}

/**
 * May the developer proceed? Only when every flagged item has a valid decision.
 * With nothing flagged this is trivially true, so the skip path proceeds
 * straight through.
 */
export function canProceed(realityCheck, decisions) {
  return flaggedItems(realityCheck).every((it) =>
    isDecisionValid(it, decisions?.[it.key])
  );
}

/**
 * What is actually blocking the proceed, counted by kind (Note 14, the
 * disabled-button affordance). A disabled button with no named blocker reads as
 * a refusal: in test, "Keep your date" plus an empty reason field rendered the
 * Assemble programme button dead with no indication of what was missing, which
 * read as "keeping your date is not allowed". Naming the gap fixes the
 * affordance without touching the mechanic.
 *
 * Returns { blocked, undecided, reasonsRequired, datesRequired, datesBelowFloor,
 * total } where total is the sum of the four gaps.
 */
export function proceedBlockers(realityCheck, decisions) {
  let undecided = 0;
  let reasonsRequired = 0;
  let datesRequired = 0;
  let datesBelowFloor = 0;

  for (const item of flaggedItems(realityCheck)) {
    const state = decisions?.[item.key] ?? {};
    const decision = state.decision ?? null;
    if (!allowedDecisions(item).includes(decision)) {
      undecided += 1;
      continue;
    }
    if (decisionNeedsReason(decision)) {
      if (typeof state.note !== 'string' || state.note.trim() === '') {
        reasonsRequired += 1;
      }
      continue;
    }
    if (decisionNeedsDate(decision)) {
      const check = checkAmendedDate(item, state);
      if (check.reason === 'missing') datesRequired += 1;
      else if (check.reason === 'below_floor') datesBelowFloor += 1;
    }
  }

  const total = undecided + reasonsRequired + datesRequired + datesBelowFloor;
  return {
    blocked: total > 0,
    undecided,
    reasonsRequired,
    datesRequired,
    datesBelowFloor,
    total,
  };
}

// One blocker phrase, singular or plural, or null when that gap is empty.
function blockerPhrase(count, one, many) {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The blockers as the one line shown beside the disabled proceed button:
 * "1 reason required, 2 dates undecided". Null when nothing is blocking, so the
 * caller renders no hint at all rather than an empty element.
 */
export function blockerLine(blockers) {
  if (!blockers?.blocked) return null;
  const parts = [
    blockerPhrase(blockers.reasonsRequired, 'reason required', 'reasons required'),
    blockerPhrase(blockers.datesRequired, 'date to set', 'dates to set'),
    blockerPhrase(
      blockers.datesBelowFloor,
      'date below its hard floor',
      'dates below their hard floor'
    ),
    blockerPhrase(blockers.undecided, 'date undecided', 'dates undecided'),
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(', ');
}

/**
 * The key of the first item that is blocking the proceed, in the engine's order,
 * so the screen can move the developer to the gap rather than leaving them to
 * hunt for it. Null when nothing is blocking.
 */
export function firstBlockingKey(realityCheck, decisions) {
  for (const item of flaggedItems(realityCheck)) {
    if (!isDecisionValid(item, decisions?.[item.key])) return item.key;
  }
  return null;
}

/**
 * The empty decision state for a reality check: one entry per flagged item, with
 * no decision chosen, no note and no amended date. There is no default
 * selection, so the screen never nudges toward one answer, and a flag_verify
 * must be explicitly answered rather than passing silently.
 */
export function initialDecisions(realityCheck) {
  const out = {};
  for (const it of flaggedItems(realityCheck)) {
    out[it.key] = { decision: null, note: '', amendedDate: '' };
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
 * programme and for the lock-time reconciliation check to read as the recorded
 * variances. within_norm items are not in the set; their dates carry forward
 * unchanged. Pure: it maps the current decisions, and the screen gates the
 * proceed on canProceed.
 *
 * Per item: the milestone or gate key, the kind, the stage, the name, the tier,
 * the developer's date, the recommended date where one exists, the agreed date,
 * the decision, and the note where one was given.
 */
export function buildResolutions(realityCheck, decisions) {
  return flaggedItems(realityCheck).map((it) => {
    const state = decisions?.[it.key] ?? {};
    const decision = state.decision ?? null;
    // Only a decision that can carry prose keeps its note. An accepted decision
    // never does, so a stale note left in the screen's state, for example a keep
    // reason typed before the developer switched to accept, is dropped here
    // rather than emitted on the resolution.
    const carriesNote =
      decision === KEPT || decision === VERIFIED || decision === AMENDED;
    const note =
      carriesNote && typeof state.note === 'string' && state.note.trim() !== ''
        ? state.note.trim()
        : null;
    return {
      key: it.key,
      kind: it.kind,
      stage: it.stage,
      name: it.name ?? null,
      tier: it.tier,
      developerDate: it.developerDate ?? null,
      recommendedDate: it.recommendedDate ?? null,
      agreedDate: agreedDate(it, decision, state),
      decision,
      note,
    };
  });
}

/**
 * Does this resolution set the operational date away from the developer's own
 * Brief date? True for an accepted recommendation and for an amend that moved
 * the date; false for a keep, an attestation or a deferral, which all hold the
 * developer's date. Used to describe the record, never to gate anything.
 */
export function isVariance(resolution) {
  const agreed = softEpoch(resolution?.agreedDate);
  const own = softEpoch(resolution?.developerDate);
  if (agreed == null || own == null) return false;
  return agreed !== own;
}
