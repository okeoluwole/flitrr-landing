/**
 * Register read (Note 19). The words the Risk register puts on the monitor's
 * verdicts. Pure and deterministic: every input is passed in, there is no clock
 * of its own, and the same verdict always produces the same sentence, so the
 * copy is unit-testable rather than only reviewable by eye.
 *
 * It sits beside riskModel.js the way dashboardRead.js sits beside
 * dashboardModel.js: the model decides what is true, this decides how it reads.
 * It changes NO derivation. The triggers in lib/engine/monitor.js, the severity
 * bands in lib/engine/severity.js, and the criticality kernel are all untouched;
 * this module only chooses which fact to say and in what words.
 *
 * THE TWO THINGS IT FIXES.
 *
 * 1. ONE ACCURATE STATUS LINE, not three boilerplate ones. The panel used to
 *    stack every fired trigger as its own bullet, so a seeded risk read "Not yet
 *    reviewed." and "Critical, with no response yet." and "Severity has
 *    escalated." at once. Three lines saying one thing is not three times the
 *    information; it is noise that trains the developer to skip the panel.
 *    statusLine picks the single most actionable fact by a fixed priority and
 *    says only that.
 *
 * 2. NO CHANGE SENTENCE WITHOUT A RECORDED CHANGE. "Severity has escalated."
 *    was rendered from the ESCALATED_SEVERITY trigger, which is a LEVEL test
 *    (the score sits at or above the escalation threshold for its criticality),
 *    not a change test. On a register nobody had touched, five of six cards
 *    claimed a movement that had never happened. The level is still worth
 *    saying, so it is now said as a level. The escalation sentence is a
 *    separate line, built only from a recorded band-raising event
 *    (lib/engine/riskEvents.js), citing from, to, when and who. With no such
 *    event it does not render, which on a freshly seeded register means it
 *    renders nowhere.
 */

import { TRIGGERS, ESCALATION_CONFIG } from '../../../../lib/engine/monitor.js';
import { CRITICALITY } from '../../../../lib/engine/criticality.js';
import { deriveSeverity, severityLegend } from '../../../../lib/engine/severity.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The Needs attention panel's collapsed state: one calm line when the monitor
// flags nothing. Proportional monitoring stays silent when things are fine.
export const ATTENTION_QUIET = 'All risks are within their review cadence.';

// The severity legend, re-exported from the engine so the register imports its
// copy from one place alongside everything else it reads.
export { severityLegend };

/**
 * How many days past its review window a risk has gone. The window comes from
 * ESCALATION_CONFIG (read, never hardcoded here), keyed by the live criticality
 * the monitor derived: 14 days for critical, 30 for standard. Returns null when
 * there is no window or no readable review stamp.
 */
function overdueDays(assessment, risk, now) {
  const cfg = ESCALATION_CONFIG.byCriticality[assessment?.effectiveCriticality];
  const reviewedAt = risk?.last_reviewed_at
    ? Date.parse(risk.last_reviewed_at)
    : NaN;
  if (!cfg || Number.isNaN(reviewedAt)) return null;
  const ageDays = (now - reviewedAt) / MS_PER_DAY;
  return Math.max(1, Math.round(ageDays - cfg.reviewWindowDays));
}

/**
 * The escalated-severity trigger stated as what it actually tests: a LEVEL, not
 * a movement. The threshold is proportional (a critical risk escalates at Worth
 * watching, a standard one only at Serious), so the sentence names the
 * criticality that set the bar, which is the part the developer can act on.
 */
function severityLevelLine(assessment, risk) {
  const severity = assessment?.severity ?? deriveSeverity(risk?.likelihood, risk?.impact);
  const band = assessment?.effectiveCriticality === CRITICALITY.CRITICAL
    ? 'critical'
    : 'standard';
  return `Scored ${severity.label}, which escalates on a ${band} risk.`;
}

/**
 * The single most actionable fact about one flagged risk, in plain words.
 *
 * The priority is fixed and deliberate, most blocking first:
 *   1. no objective link, so nothing about this risk can be classified at all
 *   2. never reviewed, so the developer has not yet formed a view
 *   3. reviewed once but lapsed, so the view they formed has gone stale
 *   4. critical with no written response, so it is watched but unanswered
 *   5. the score itself sits at the escalation threshold
 * Everything below the winner is true as well; it is simply not the thing to
 * say first, and saying all five says nothing.
 *
 * Returns null when the monitor flagged nothing, which is the caller's cue that
 * the risk does not belong in the queue.
 */
export function statusLine(assessment, risk, now) {
  if (assessment == null) return null;
  if (assessment.needsLink) return 'Needs a link to an objective.';

  const fired = new Set(assessment.firedTriggers ?? []);
  if (fired.has(TRIGGERS.NOT_YET_ENGAGED)) return 'Awaiting first review.';
  if (fired.has(TRIGGERS.WENT_STALE)) {
    const days = overdueDays(assessment, risk, now);
    return days == null
      ? 'Overdue for review.'
      : `Overdue for review by ${days} day${days === 1 ? '' : 's'}.`;
  }
  if (fired.has(TRIGGERS.CRITICAL_UNMANAGED)) {
    return 'Critical, with no response recorded yet.';
  }
  if (fired.has(TRIGGERS.ESCALATED_SEVERITY)) {
    return severityLevelLine(assessment, risk);
  }
  return null;
}

/**
 * The recorded escalation as one sentence, or null when there is none.
 *
 * This is the ONLY place the register may claim a severity movement, and it can
 * only be reached with an escalation object built from a real row in
 * project_risk_events. It names the four facts that make the claim checkable:
 * the band before, the band after, when, and who. Pass null (the normal case on
 * a register that has recorded no change) and it returns null, so the caller
 * renders nothing.
 *
 *   escalation  { from, to, at, by } from riskEvents.deriveEscalation
 *   bandLabel   band key -> label, so the engine keeps holding no display strings
 *   actorName   actor id -> name, for the who; falls back to "a team member"
 *   formatDate  ISO -> display date, the caller's own UTC-pinned formatter
 */
export function escalationLine(
  escalation,
  { bandLabel = (k) => k, actorName = () => null, formatDate = (d) => d } = {}
) {
  if (escalation == null) return null;
  const from = bandLabel(escalation.from) ?? escalation.from;
  const to = bandLabel(escalation.to) ?? escalation.to;
  const when = escalation.at ? formatDate(escalation.at) : null;
  const who = actorName(escalation.by) ?? 'a team member';
  const whenPart = when ? ` on ${when}` : '';
  return `Raised from ${from} to ${to}${whenPart}, by ${who}.`;
}

// Plural helper, so the headings below stay readable.
function plural(n, one, many) {
  return n === 1 ? one : many;
}

/**
 * The queue's own heading line: what is in it, and where it came from.
 *
 * The panel used to be titled "Needs attention" with nothing under it but the
 * cards, so a first-run register of six never-reviewed Brief risks read as six
 * problems rather than six things to look at once. The line is derived from
 * what is actually queued, never assumed:
 *
 *   every item awaiting a first review, all from the Brief
 *     -> "6 risks from your brief await first review."
 *   every item awaiting a first review, some from elsewhere
 *     -> "6 risks await first review, 4 of them from your brief."
 *   a mixed queue
 *     -> "6 risks need a look, 4 of them awaiting first review."
 *
 * Returns null for an empty queue; the caller shows ATTENTION_QUIET instead.
 */
export function queueHeading({ total, awaitingFirstReview = 0, fromBrief = 0 }) {
  if (!total || total <= 0) return null;
  const noun = plural(total, 'risk', 'risks');

  if (awaitingFirstReview === total) {
    if (fromBrief === total) {
      return `${total} ${noun} from your brief ${plural(total, 'awaits', 'await')} first review.`;
    }
    if (fromBrief > 0) {
      return `${total} ${noun} ${plural(total, 'awaits', 'await')} first review, ${fromBrief} of them from your brief.`;
    }
    return `${total} ${noun} ${plural(total, 'awaits', 'await')} first review.`;
  }

  const lead = `${total} ${noun} ${plural(total, 'needs', 'need')} a look`;
  if (awaitingFirstReview > 0) {
    return `${lead}, ${awaitingFirstReview} of them awaiting first review.`;
  }
  return `${lead}.`;
}

/**
 * Where a risk came from, in words (Note 19, migration 032). A risk with no
 * source was captured at initiation, so it sits in the locked Brief; a risk
 * carrying 'playbook' was accepted from a curated play. Nothing is guessed: the
 * column says which, and every existing row correctly reads as Brief-captured.
 */
export function riskProvenance(risk) {
  return risk?.source === 'playbook'
    ? "From PULSE's playbook"
    : 'From your brief';
}

// True when a risk came from the Brief, the count queueHeading takes.
export function isFromBrief(risk) {
  return risk?.source !== 'playbook';
}

/**
 * How a risk relates to the objective it is linked to (Note 7). A risk
 * THREATENS its objective; it does not merely sit beside it. "vs Cost" said
 * neither, so the register now says what the link means.
 */
export function objectiveRelation(objectiveName) {
  return objectiveName ? `threatens ${objectiveName}` : 'Needs a link';
}
