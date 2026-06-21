/**
 * The PULSE read: the derived-intelligence ruleset for the brief (Step 8).
 *
 * Deterministic, computed from the project's own data. No AI, no external
 * data. Each insight names the actual objectives and counts involved, so it
 * is specific to the project and never generic. The ruleset began as the M3.5
 * spec, Rules 1 to 5; Rules 3 (coverage) and 5 (funding governance) were retired
 * in sub-step 1f, since milestones are now the curated template and the gaps they
 * detected can no longer occur. The live rules are 1 (posture), 2 (risk
 * concentration) and 4 (tolerance gaps).
 *
 * Input is the normalised `facts` object assembled in briefModel:
 *   facts.objectives  [{ id, type, name, classification, rank, definition,
 *                        tolerance }]  (rank order)
 *   facts.protected   objectives classified non_negotiable (rank order)
 *   facts.flexible    objectives classified flexible        (rank order)
 *   facts.workstreams [{ name, lead, critical, linkedId }]
 *   facts.risks       [{ num, description, critical, linkedId, ... }]
 *
 * Output is an ordered array of insights:
 *   { n, tone: 'standard' | 'warn', title, body }
 * Rule 1 (posture) is always first; the remaining rules follow in order, each
 * only if it fires. `tone: 'warn'` marks the amber advisory treatment (the
 * over-constraint case and the gap flags); positive and neutral reads use the
 * standard treatment.
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

/**
 * Compute the ordered insight list for a project. Rule 1 (posture) first, then
 * the remaining rules in order, each only if it fires. Insights are numbered
 * 1..n for the badge in display order.
 *
 * Rules 3 (coverage) and 5 (funding governance) were retired in sub-step 1f:
 * with milestones now the curated template, every protected objective except
 * Scope is served by a template milestone and Funding always is, so the gaps
 * those rules detected can no longer occur.
 */
export function computeInsights(facts) {
  const out = [rulePosture(facts)];

  const concentration = ruleRiskConcentration(facts);
  if (concentration) out.push(concentration);

  const tolerance = ruleToleranceGaps(facts);
  if (tolerance) out.push(tolerance);

  return out.map((insight, i) => ({ n: i + 1, ...insight }));
}
