/**
 * The programme lock reconciliation engine. The guard that runs at the moment
 * v1 is locked (the review-and-lock screen, Programme set-up): it compares the
 * assembled programme, point by point, against the locked Brief's own
 * programme record, and it compares v1's completion against the Step 1 target
 * completion. The single-source rule made mechanical: the Brief document and
 * v1 must be provably assembled from the identical record set, so any
 * unexplained mismatch blocks the lock with a named difference.
 *
 * WHAT MAY LEGITIMATELY DIFFER. Three things, and only three:
 *   - a recorded variance: a reconcile resolution (Phase 1.2) agreed a date
 *     that differs from the Brief's, and the resolution records the decision;
 *   - a disclosed derivation: a drill-down milestone the engine dated from the
 *     template offset, or an undated applicable gate the rolling chain dated
 *     from gateWeeks. Every derivation is returned in `derivations` with its
 *     basis, so the review can list each one before the lock;
 *   - an honestly undated point on both sides (no date is not a mismatch when
 *     neither record holds one).
 * Anything else is a difference, returned by name, and the lock must not
 * proceed while one stands.
 *
 * THE COMPLETION COMPARISON. v1's completion is the completion gate per the
 * baseline: the latest applicable gate's baseline date, never a milestone
 * tail. It is compared against the Step 1 target completion. A breach does
 * not join `differences` (it is not a record mismatch); it is returned on
 * `completion` so the caller can block the lock until the developer expressly
 * accepts it as a recorded decision.
 *
 * THE REFERENCE RECORD SET. Preferably the locked Brief's `programme` section
 * (source 'brief'), the raw record set the Brief snapshot carries from schema
 * version 3. For a Brief locked before that section existed the caller falls
 * back to the live programme choices (source 'store'), the same rows the
 * assembler consumed: the derivation and completion guards still hold, and
 * the source is reported so the screen can say which record set was checked.
 *
 * Pure and deterministic: no DB, no React, no network, no clock. Same inputs,
 * same result.
 */

import { MILESTONE_TIER } from './programmeTemplate.js';
import { ITEM_ORIGIN } from './programmeAssembly.js';
import { CRITICALITY } from './criticality.js';

// One week in milliseconds, the shared convention of the sibling engines.
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Where the reference record set came from.
export const RECONCILIATION_SOURCES = Object.freeze({
  BRIEF: 'brief',
  STORE: 'store',
});

// The named kinds of difference the check can raise. Each blocks the lock.
export const DIFFERENCE_KINDS = Object.freeze({
  GATE_APPLICABILITY: 'gate_applicability',
  GATE_DATE: 'gate_date',
  MILESTONE_DATE: 'milestone_date',
  MILESTONE_MISSING: 'milestone_missing',
  DERIVED_ON_GOVERNED: 'derived_on_governed',
  DERIVED_ON_PROTECTED: 'derived_on_protected',
  DERIVATION_BASIS: 'derivation_basis',
  DERIVED_PAST_COMPLETION: 'derived_past_completion',
});

// The bases a disclosed derivation can carry.
export const DERIVATION_RULES = Object.freeze({
  STAGE_START_PLUS_OFFSET: 'stage_start_plus_offset',
  ROLLED_FROM_GATE_WEEKS: 'rolled_from_gate_weeks',
  UNDATED_PROTECTED: 'undated_protected',
});

// Soft parse to epoch milliseconds, or null. Mirrors the sibling engines'
// softEpoch so both sides of every comparison read dates the same way.
function softEpoch(value) {
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

function toDate(epoch) {
  return epoch == null ? null : new Date(epoch);
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Day-precise UTC date for the named differences and the completion line:
 * "23 Jul 2026". Never month and year alone. Null in, null out.
 */
export function formatReconciliationDate(value) {
  const epoch = softEpoch(value);
  if (epoch == null) return null;
  const d = new Date(epoch);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Build the reference record set from a locked Brief's `programme` section
 * (brief content schema version 3 and later). Returns null when the section
 * is absent or not the expected shape, so the caller can fall back to the
 * store reference.
 */
export function referenceFromBriefProgramme(briefProgramme) {
  if (
    briefProgramme == null ||
    typeof briefProgramme !== 'object' ||
    !Array.isArray(briefProgramme.gates) ||
    !Array.isArray(briefProgramme.milestones)
  ) {
    return null;
  }
  return {
    source: RECONCILIATION_SOURCES.BRIEF,
    gates: briefProgramme.gates.map((g) => ({
      stage: g?.stage ?? null,
      date: g?.date ?? null,
      na: g?.na === true,
    })),
    milestones: briefProgramme.milestones.map((m) => ({
      key: m?.key ?? null,
      stage: m?.stage ?? null,
      name: m?.name ?? null,
      date: m?.date ?? null,
    })),
  };
}

/**
 * Build the reference record set from the live programme choices (the
 * project_stage_gates rows, as loadProgrammeChoices returns them). The
 * fallback for a Brief locked before the programme section existed: the same
 * rows the assembler consumed, so the derivation and completion guards still
 * hold even though the Brief snapshot itself cannot be compared exactly.
 */
export function referenceFromChoices(choices) {
  const list = Array.isArray(choices) ? choices : (choices?.stages ?? []);
  const gates = [];
  const milestones = [];
  for (const stageChoice of list) {
    if (stageChoice == null || stageChoice.stage == null) continue;
    gates.push({
      stage: stageChoice.stage,
      date:
        stageChoice.target_date == null || String(stageChoice.target_date).trim() === ''
          ? null
          : stageChoice.target_date,
      na: stageChoice.target_na === true,
    });
    const stageMilestones = stageChoice.milestones ?? {};
    for (const key of Object.keys(stageMilestones)) {
      const mc = stageMilestones[key] ?? {};
      milestones.push({
        key,
        stage: stageChoice.stage,
        name: null,
        date:
          mc.target_date == null || String(mc.target_date).trim() === ''
            ? null
            : mc.target_date,
      });
    }
  }
  return { source: RECONCILIATION_SOURCES.STORE, gates, milestones };
}

// The reference gates and milestones as lookups. A reference milestone keyed
// null is unmatchable and dropped.
function referenceLookups(reference) {
  const gateByStage = new Map();
  for (const gate of reference?.gates ?? []) {
    if (gate == null || gate.stage == null) continue;
    gateByStage.set(gate.stage, gate);
  }
  const milestoneByKey = new Map();
  for (const milestone of reference?.milestones ?? []) {
    if (milestone == null || milestone.key == null) continue;
    milestoneByKey.set(milestone.key, milestone);
  }
  return { gateByStage, milestoneByKey };
}

function resolutionLookup(resolutions) {
  const lookup = new Map();
  for (const res of resolutions ?? []) {
    if (res == null || res.key == null) continue;
    lookup.set(res.key, res);
  }
  return lookup;
}

// The completion gate per the baseline: the latest applicable gate's baseline
// epoch across the assembled programme. Gates only, never a milestone.
export function baselineCompletionGateEpoch(assembled) {
  let latest = null;
  for (const stage of assembled?.stages ?? []) {
    if (stage == null || stage.applicable === false) continue;
    const epoch = softEpoch(stage.gate?.baselineDate);
    if (epoch != null && (latest == null || epoch > latest)) latest = epoch;
  }
  return latest;
}

/**
 * Reconcile an assembled programme against the reference record set and the
 * Step 1 target completion.
 *
 *   assembled              assembleProgramme's output, the object 2.2 freezes
 *   reference              referenceFromBriefProgramme(...) or
 *                          referenceFromChoices(...)
 *   resolutions            the reconcile resolution set (buildResolutions),
 *                          the recorded variances; empty when nothing was
 *                          flagged
 *   targetCompletionDate   the Step 1 target completion
 *                          (projects.target_completion_date), or null
 *
 * Returns:
 *   {
 *     source,        'brief' | 'store', where the reference came from
 *     ok,            true when no difference stands (the completion breach is
 *                    separate, on `completion`)
 *     differences: [
 *       { kind, key, stage, name, briefDate, baselineDate, expectedDate }
 *     ],
 *     derivations: [
 *       { key, kind, stage, name, criticality, baselineDate, rule, offsetWeeks }
 *     ],
 *     completion: {
 *       baselineCompletionDate,   the completion gate per the baseline
 *       targetCompletionDate,
 *       weeksLate,                exact signed weeks, null where a side is
 *                                 missing
 *       breached,                 weeksLate > 0
 *     }
 *   }
 */
export function reconcileBaseline({
  assembled,
  reference,
  resolutions,
  targetCompletionDate,
}) {
  const { gateByStage, milestoneByKey } = referenceLookups(reference);
  const resolutionByKey = resolutionLookup(resolutions);
  const source = reference?.source ?? RECONCILIATION_SOURCES.STORE;

  const differences = [];
  const derivations = [];

  const completionEpoch = baselineCompletionGateEpoch(assembled);
  const assembledMilestoneKeys = new Set();

  for (const stage of assembled?.stages ?? []) {
    if (stage == null) continue;
    const stageNum = stage.stage ?? null;
    const refGate = gateByStage.get(stageNum) ?? { date: null, na: false };
    const applicable = stage.applicable !== false;

    // Applicability must agree: a stage the Brief record marks not applicable
    // cannot be assembled as applicable, and the reverse.
    if (refGate.na !== !applicable) {
      differences.push({
        kind: DIFFERENCE_KINDS.GATE_APPLICABILITY,
        key: stage.gate?.key ?? `gate_${stageNum}`,
        stage: stageNum,
        name: stage.name ?? null,
        briefDate: null,
        baselineDate: null,
        expectedDate: null,
      });
      continue;
    }
    if (!applicable) continue;

    // The gate date: the recorded variance where one exists, else the
    // reference date. An undated reference gate that the rolling chain dated
    // from gateWeeks is a disclosed derivation, not a mismatch.
    const gateKey = stage.gate?.key ?? `gate_${stageNum}`;
    const gateRes = resolutionByKey.get(gateKey);
    const gateAssembledEpoch = softEpoch(stage.gate?.baselineDate);
    const gateExpectedEpoch =
      gateRes != null ? softEpoch(gateRes.agreedDate) : softEpoch(refGate.date);
    if (gateExpectedEpoch == null && gateAssembledEpoch != null) {
      derivations.push({
        key: gateKey,
        kind: 'gate',
        stage: stageNum,
        name: stage.name ?? null,
        criticality: null,
        baselineDate: toDate(gateAssembledEpoch),
        rule: DERIVATION_RULES.ROLLED_FROM_GATE_WEEKS,
        offsetWeeks: null,
      });
    } else if (gateExpectedEpoch !== gateAssembledEpoch) {
      differences.push({
        kind: DIFFERENCE_KINDS.GATE_DATE,
        key: gateKey,
        stage: stageNum,
        name: stage.name ?? null,
        briefDate: toDate(softEpoch(refGate.date)),
        baselineDate: toDate(gateAssembledEpoch),
        expectedDate: toDate(gateExpectedEpoch),
      });
    }

    const stageStartEpoch = softEpoch(stage.stageStart);

    for (const activity of stage.activities ?? []) {
      for (const milestone of activity?.milestones ?? []) {
        if (milestone == null || milestone.key == null) continue;
        assembledMilestoneKeys.add(milestone.key);
        const assembledEpoch = softEpoch(milestone.baselineDate);
        const isCritical = milestone.criticality === CRITICALITY.CRITICAL;

        if (milestone.origin === ITEM_ORIGIN.ADDED) {
          // A point the engine added. A headline point may never be added,
          // and a critical added point may never carry a derived date.
          if (milestone.tier === MILESTONE_TIER.HEADLINE) {
            differences.push({
              kind: DIFFERENCE_KINDS.DERIVED_ON_GOVERNED,
              key: milestone.key,
              stage: stageNum,
              name: milestone.name ?? null,
              briefDate: null,
              baselineDate: toDate(assembledEpoch),
              expectedDate: null,
            });
            continue;
          }
          if (isCritical && assembledEpoch != null) {
            differences.push({
              kind: DIFFERENCE_KINDS.DERIVED_ON_PROTECTED,
              key: milestone.key,
              stage: stageNum,
              name: milestone.name ?? null,
              briefDate: null,
              baselineDate: toDate(assembledEpoch),
              expectedDate: null,
            });
            continue;
          }
          if (assembledEpoch == null) {
            derivations.push({
              key: milestone.key,
              kind: 'milestone',
              stage: stageNum,
              name: milestone.name ?? null,
              criticality: milestone.criticality ?? null,
              baselineDate: null,
              rule: DERIVATION_RULES.UNDATED_PROTECTED,
              offsetWeeks: milestone.offsetWeeks ?? null,
            });
            continue;
          }
          // A dated derivation must sit exactly on its stated basis, the
          // agreed stage start plus the curated offset...
          const basisEpoch =
            stageStartEpoch == null || milestone.offsetWeeks == null
              ? null
              : stageStartEpoch + milestone.offsetWeeks * MS_PER_WEEK;
          if (basisEpoch == null || basisEpoch !== assembledEpoch) {
            differences.push({
              kind: DIFFERENCE_KINDS.DERIVATION_BASIS,
              key: milestone.key,
              stage: stageNum,
              name: milestone.name ?? null,
              briefDate: null,
              baselineDate: toDate(assembledEpoch),
              expectedDate: toDate(basisEpoch),
            });
            continue;
          }
          // ...and it must reconcile against the completion gate: a derived
          // point past the last applicable gate is a named difference.
          if (completionEpoch != null && assembledEpoch > completionEpoch) {
            differences.push({
              kind: DIFFERENCE_KINDS.DERIVED_PAST_COMPLETION,
              key: milestone.key,
              stage: stageNum,
              name: milestone.name ?? null,
              briefDate: null,
              baselineDate: toDate(assembledEpoch),
              expectedDate: toDate(completionEpoch),
            });
            continue;
          }
          derivations.push({
            key: milestone.key,
            kind: 'milestone',
            stage: stageNum,
            name: milestone.name ?? null,
            criticality: milestone.criticality ?? null,
            baselineDate: toDate(assembledEpoch),
            rule: DERIVATION_RULES.STAGE_START_PLUS_OFFSET,
            offsetWeeks: milestone.offsetWeeks ?? null,
          });
          continue;
        }

        // A carried point: the developer's own record. The recorded variance
        // where one exists, else the reference date, and undated on both
        // sides is agreement, not a mismatch.
        const res = resolutionByKey.get(milestone.key);
        const refMilestone = milestoneByKey.get(milestone.key) ?? { date: null };
        const expectedEpoch =
          res != null ? softEpoch(res.agreedDate) : softEpoch(refMilestone.date);
        if (expectedEpoch !== assembledEpoch) {
          differences.push({
            kind: DIFFERENCE_KINDS.MILESTONE_DATE,
            key: milestone.key,
            stage: stageNum,
            name: milestone.name ?? null,
            briefDate: toDate(softEpoch(refMilestone.date)),
            baselineDate: toDate(assembledEpoch),
            expectedDate: toDate(expectedEpoch),
          });
        }
      }
    }
  }

  // A reference milestone v1 does not carry at all is a named difference: the
  // record sets must hold the same points.
  for (const [key, refMilestone] of milestoneByKey) {
    if (assembledMilestoneKeys.has(key)) continue;
    differences.push({
      kind: DIFFERENCE_KINDS.MILESTONE_MISSING,
      key,
      stage: refMilestone.stage ?? null,
      name: refMilestone.name ?? null,
      briefDate: toDate(softEpoch(refMilestone.date)),
      baselineDate: null,
      expectedDate: toDate(softEpoch(refMilestone.date)),
    });
  }

  const targetEpoch = softEpoch(targetCompletionDate);
  const weeksLate =
    completionEpoch != null && targetEpoch != null
      ? (completionEpoch - targetEpoch) / MS_PER_WEEK
      : null;

  return {
    source,
    ok: differences.length === 0,
    differences,
    derivations,
    completion: {
      baselineCompletionDate: toDate(completionEpoch),
      targetCompletionDate: toDate(targetEpoch),
      weeksLate,
      breached: weeksLate != null && weeksLate > 0,
    },
  };
}

const KIND_LABEL = { gate: 'Gate', milestone: 'Milestone' };

/**
 * One difference as a plain sentence, shared by the review screen and the
 * tests so the naming and the punctuation discipline live once. Dates read
 * day-precise ("23 Jul 2026"); an absent date reads "no date".
 */
export function describeDifference(diff) {
  const name = diff?.name ?? diff?.key ?? 'A programme point';
  const stagePart = diff?.stage != null ? ` (Stage ${diff.stage})` : '';
  const brief = formatReconciliationDate(diff?.briefDate) ?? 'no date';
  const baseline = formatReconciliationDate(diff?.baselineDate) ?? 'no date';
  const expected = formatReconciliationDate(diff?.expectedDate) ?? 'no date';

  switch (diff?.kind) {
    case DIFFERENCE_KINDS.GATE_APPLICABILITY:
      return `${name}${stagePart}: the applicability in v1 does not match the locked record.`;
    case DIFFERENCE_KINDS.GATE_DATE:
      return `${name}${stagePart}: the locked record holds ${expected}, v1 holds ${baseline}.`;
    case DIFFERENCE_KINDS.MILESTONE_DATE:
      return `${name}${stagePart}: the locked record holds ${expected}, v1 holds ${baseline}.`;
    case DIFFERENCE_KINDS.MILESTONE_MISSING:
      return `${name}${stagePart}: the locked record holds this point (${brief}) but v1 does not carry it.`;
    case DIFFERENCE_KINDS.DERIVED_ON_GOVERNED:
      return `${name}${stagePart}: a date was derived on a point you govern. Your points are never auto dated.`;
    case DIFFERENCE_KINDS.DERIVED_ON_PROTECTED:
      return `${name}${stagePart}: a date was derived on a point that serves a protected objective. Protected points are never auto dated.`;
    case DIFFERENCE_KINDS.DERIVATION_BASIS:
      return `${name}${stagePart}: the derived date ${baseline} does not sit on its stated basis of ${expected}.`;
    case DIFFERENCE_KINDS.DERIVED_PAST_COMPLETION:
      return `${name}${stagePart}: the derived date ${baseline} falls after the completion gate of ${expected}.`;
    default:
      return `${name}${stagePart}: v1 does not match the locked record.`;
  }
}
