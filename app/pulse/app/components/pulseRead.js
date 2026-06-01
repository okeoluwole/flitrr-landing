/**
 * The PULSE read: the derived-intelligence ruleset for the brief (Step 8).
 *
 * Deterministic, computed from the project's own data. No AI, no external
 * data. Each insight names the actual objectives and counts involved, so it
 * is specific to the project and never generic. The ruleset is the M3.5
 * spec, Rules 1 to 5, verbatim in intent.
 *
 * Input is the normalised `facts` object assembled in briefModel:
 *   facts.objectives  [{ id, type, name, classification, rank, definition,
 *                        tolerance }]  (rank order)
 *   facts.protected   objectives classified non_negotiable (rank order)
 *   facts.flexible    objectives classified flexible        (rank order)
 *   facts.milestones  [{ name, critical, linkedId }]   (real, non-blank)
 *   facts.workstreams [{ name, lead, critical, linkedId }]
 *   facts.risks       [{ num, description, critical, linkedId, ... }]
 *
 * Output is an ordered array of insights:
 *   { n, tone: 'standard' | 'warn', title, body }
 * Rule 1 (posture) is always first; Rules 2 to 5 follow in order, each only
 * if it fires. `tone: 'warn'` marks the amber advisory treatment (the
 * over-constraint case and the gap flags); positive and neutral reads use
 * the standard treatment.
 */

import { formatList } from './briefFormat';

const STANDARD = 'standard';
const WARN = 'warn';

// "1 risk" / "2 risks".
function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Rule 1, Posture (always shown). Reads the non-negotiable count and names
// the protected and flexible objectives.
function rulePosture(facts) {
  const nn = facts.protected.length;
  const protectedNames = facts.protected.map((o) => o.name);
  const flexibleNames = facts.flexible.map((o) => o.name);

  if (nn === 5) {
    return {
      tone: WARN,
      title: 'Every objective is non-negotiable',
      body:
        'Every objective is marked non-negotiable. This project has no room to flex and is usually undeliverable. Revisit which objective can give.',
    };
  }

  if (nn === 0) {
    return {
      tone: STANDARD,
      title: 'Nothing is fixed',
      body:
        'No objective is marked non-negotiable. The project is fully flexible, which gives maximum room to manoeuvre but anchors nothing as a firm commitment. Confirm that is intended.',
    };
  }

  if (nn >= 3) {
    return {
      tone: STANDARD,
      title: 'A tight but coherent posture',
      body:
        `This project protects ${formatList(protectedNames)} and lets ${formatList(flexibleNames)} flex. ` +
        `${nn} fixed objectives is a tight posture, but a coherent one. The flexible objectives are the only levers if conditions change, and this brief states that so no reader assumes more give than exists.`,
    };
  }

  // nn is 1 or 2.
  return {
    tone: STANDARD,
    title: 'A balanced posture',
    body:
      `This project protects ${formatList(protectedNames)} and keeps ${formatList(flexibleNames)} flexible. ` +
      'A balanced posture with room to absorb pressure.',
  };
}

// Rule 2, Risk concentration. Looks at where the critical risks sit relative
// to the non-negotiable objectives.
function ruleRiskConcentration(facts) {
  const nn = facts.protected.length;
  const criticalRisks = facts.risks.filter((r) => r.critical);

  if (criticalRisks.length === 0) {
    if (nn >= 1) {
      return {
        tone: STANDARD,
        title: 'No critical risks flagged',
        body:
          `No risks are flagged critical. For a project with ${plural(nn, 'non-negotiable objective')}, confirm the risk profile is complete.`,
      };
    }
    return null;
  }

  // Critical risks whose linked objective is non-negotiable.
  const aligned = criticalRisks.filter((r) => {
    const obj = facts.objectiveById[r.linkedId];
    return obj && obj.classification === 'non_negotiable';
  });

  const Y = criticalRisks.length;
  const X = aligned.length;

  // "Most" is a strict majority of all critical risks. Unlinked risks and
  // risks against a flexible objective count toward the misaligned side.
  if (X > Y / 2) {
    // Distinct non-negotiable objectives the aligned critical risks cluster
    // on, in rank order.
    const clusterNames = facts.protected
      .filter((o) => aligned.some((r) => r.linkedId === o.id))
      .map((o) => o.name);
    const isAre = clusterNames.length > 1 ? 'are' : 'is';
    return {
      tone: STANDARD,
      title: 'Risk concentrates where it should',
      body:
        `${X} of ${plural(Y, 'critical risk')} sit against ${formatList(clusterNames)}, the objectives marked non-negotiable. ` +
        `The risk posture matches the stated priorities, which is the right alignment, and confirms ${formatList(clusterNames)} ${isAre} where the project is won or lost.`,
    };
  }

  return {
    tone: WARN,
    title: 'Risk may not match the priorities',
    body:
      'Most critical risks sit against objectives marked flexible or left unlinked, while the non-negotiable objectives carry little flagged risk. Check the risk profile reflects the real priorities.',
  };
}

// Build the body of the consolidated coverage card. Groups the milestone
// gaps and the lead gaps and names the objectives in each. Reads as one
// clause when the two groups share the same objectives, otherwise as two.
function buildCoverageBody(missingMilestone, missingLead) {
  const closer =
    'Protected objectives with no owner or tracking milestone are the first thing a reviewer challenges.';

  // Same objectives lack both a milestone and a lead: collapse to one clause.
  const sameSet =
    missingMilestone.length > 0 &&
    missingLead.length > 0 &&
    missingMilestone.length === missingLead.length &&
    missingMilestone.every((name) => missingLead.includes(name));

  if (sameSet) {
    const names = formatList(missingMilestone);
    const lead =
      missingMilestone.length === 1
        ? `${names} is protected but has no milestone tied to it and no accountable workstream lead.`
        : `${names} are protected but have no milestone tied to them, and none has an accountable workstream lead.`;
    return `${lead} ${closer}`;
  }

  const parts = [];
  if (missingMilestone.length) {
    const v = missingMilestone.length === 1 ? 'has' : 'have';
    const it = missingMilestone.length === 1 ? 'it' : 'them';
    parts.push(`${formatList(missingMilestone)} ${v} no milestone tied to ${it}`);
  }
  if (missingLead.length) {
    const v = missingLead.length === 1 ? 'has' : 'have';
    parts.push(`${formatList(missingLead)} ${v} no accountable workstream lead`);
  }
  return `${parts.join(', and ')}. ${closer}`;
}

// Rule 3, Coverage (skipped when nn is 0). Each non-negotiable objective
// should have at least one linked milestone and at least one linked
// workstream with a named lead. Emits a SINGLE consolidated card naming the
// objectives that lack a milestone and those that lack an accountable lead,
// or a single positive card when every protected objective is covered, so a
// project with nothing linked produces one clear insight rather than a wall
// of near-identical cards.
//
// `suppressFundingMilestoneGap`: when Rule 5 fires (Funding non-negotiable
// with no linked milestone) it gives that case a specific card, so Funding
// is dropped from the milestone-gap list here to avoid saying the same thing
// twice. Funding can still appear in the lead-gap list. A suppressed gap
// still counts as a real gap, so the positive read cannot fire while Rule 5
// reports a funding milestone gap.
function ruleCoverage(facts, { suppressFundingMilestoneGap = false } = {}) {
  const nn = facts.protected.length;
  if (nn === 0) return [];

  const missingMilestone = [];
  const missingLead = [];
  let anyGap = false;

  for (const obj of facts.protected) {
    const hasMilestone = facts.milestones.some((m) => m.linkedId === obj.id);
    const hasLed = facts.workstreams.some(
      (w) => w.linkedId === obj.id && w.lead
    );
    const isFunding = obj.type === 'funding';

    if (!hasMilestone) {
      anyGap = true;
      if (!(isFunding && suppressFundingMilestoneGap)) {
        missingMilestone.push(obj.name);
      }
    }
    if (!hasLed) {
      anyGap = true;
      missingLead.push(obj.name);
    }
  }

  // No gap anywhere: the positive read.
  if (!anyGap) {
    return [
      {
        tone: STANDARD,
        title: 'Every protected objective is owned',
        body:
          'Every protected objective is backed by at least one milestone and an accountable workstream lead. Nothing marked critical is left unowned.',
      },
    ];
  }

  // Gaps existed but all were suppressed (only Funding's milestone, which
  // Rule 5 reports instead): no coverage card here.
  if (missingMilestone.length === 0 && missingLead.length === 0) {
    return [];
  }

  return [
    {
      tone: WARN,
      title: 'Coverage gaps in the protected set',
      body: buildCoverageBody(missingMilestone, missingLead),
    },
  ];
}

// Rule 4, Tolerance gaps. Flexible objectives with no stated tolerance are
// ambiguous; name them in a single insight.
function ruleToleranceGaps(facts) {
  const missing = facts.flexible.filter((o) => !o.tolerance);
  if (missing.length === 0) return null;
  const names = missing.map((o) => o.name);
  return {
    tone: WARN,
    title: 'Flexibility without a limit',
    body:
      `You marked ${formatList(names)} flexible but have not stated within what bounds. ` +
      'Flexibility without a limit is ambiguous. Define the tolerance so readers know how much give exists.',
  };
}

// Rule 5, Funding governance. If Funding is non-negotiable but no milestone
// is tied to it, the commitment is not trackable.
function ruleFundingGovernance(facts) {
  const funding = facts.objectives.find((o) => o.type === 'funding');
  if (!funding || funding.classification !== 'non_negotiable') return null;
  const hasMilestone = facts.milestones.some((m) => m.linkedId === funding.id);
  if (hasMilestone) return null;
  return {
    tone: WARN,
    title: 'Funding is not yet trackable',
    body:
      'Funding is non-negotiable, but no milestone is tied to it. A funding close or drawdown milestone makes that commitment trackable.',
  };
}

/**
 * Compute the ordered insight list for a project. Rule 1 first, then Rules 2
 * to 5 in order, each only if it fires. Insights are numbered 1..n for the
 * badge in display order.
 */
export function computeInsights(facts) {
  const out = [rulePosture(facts)];

  const concentration = ruleRiskConcentration(facts);
  if (concentration) out.push(concentration);

  // Resolve Rule 5 up front so Rule 3 can suppress its funding milestone gap
  // when Rule 5 will report it. Rule 5 still renders in order, after Rule 4.
  const funding = ruleFundingGovernance(facts);
  out.push(...ruleCoverage(facts, { suppressFundingMilestoneGap: !!funding }));

  const tolerance = ruleToleranceGaps(facts);
  if (tolerance) out.push(tolerance);

  if (funding) out.push(funding);

  return out.map((insight, i) => ({ n: i + 1, ...insight }));
}
