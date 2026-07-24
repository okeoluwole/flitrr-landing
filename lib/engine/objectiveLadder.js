/**
 * The objective status ladder (Dashboard module, Note 20). One status per
 * objective on a four-rung ladder, plus the honest unscored state, each
 * carrying a plain-language driver naming the real, cited fact that set it.
 * The cockpit's hero band renders these rows; nothing else is derived here.
 *
 * THE LADDER, worst rung last:
 *
 *   healthy      No live Serious risk, no slip beyond tolerance, no breach.
 *   at_risk      A Serious-band risk is live against the objective. A live
 *                risk is EXPOSURE, not compromise: it reads At risk, never
 *                Compromised, whatever the objective's classification.
 *   slipping     Points serving the objective have slipped against the locked
 *                baseline, read straight off the tracker's flags (the RAG
 *                engine's amber and red), never re-derived here.
 *   compromised  RESERVED FOR BREACH IN FACT: today, a forecast completion
 *                past the stated target (the Time date signal). The other
 *                breach-in-fact conditions the rung is reserved for (a gate
 *                passed unmet, a hard floor breached, a recorded compromise
 *                decision) join here when the data that records them exists;
 *                none is invented from a softer signal in the meantime.
 *   not_scored   Nothing has been assessed against the objective. NEVER
 *                inferred as Healthy: green must mean we looked and found
 *                nothing, not that nothing was entered. A breach in fact
 *                still outranks it, because a forecast measured against the
 *                locked baseline IS an assessment.
 *
 * CALL, NEVER RECOMPUTE. This module takes deriveObjectiveHealth's output and
 * reads its per-row SIGNALS (worstRisk, seriousCount, programmeFlag, the
 * always-carried dateSignal, and the not_scored state). It re-derives no
 * severity, no criticality, no RAG colour, and no date arithmetic: every
 * figure in a driver was computed by the engine that owns it. The health
 * engine's own two-ladder states are not read; the ladder is the Note 20
 * re-expression of the same signals.
 *
 * Pure, deterministic, and server-safe: no DB, no React, no network, no
 * system clock. The same health read always gives the same ladder. It
 * mutates nothing it is given.
 *
 * THE DRIVER IS PART OF THE CONTRACT. A status renders only from a real,
 * cited driver, so the words are derived here beside the rung and tested
 * with it: a rung without its driver is a build error, not a rendering
 * choice. The structured trigger rides alongside for any surface that needs
 * the raw fact.
 */

// The five statuses, frozen so a caller cannot mutate the vocabulary.
export const LADDER_STATUSES = Object.freeze({
  HEALTHY: 'healthy',
  AT_RISK: 'at_risk',
  SLIPPING: 'slipping',
  COMPROMISED: 'compromised',
  NOT_SCORED: 'not_scored',
});

// The structured trigger keys: the one fact that set each status.
export const LADDER_TRIGGERS = Object.freeze({
  // Nothing assessed against the objective. Detail null.
  NOT_SCORED: 'not_scored',
  // Assessed, and nothing live threatens it. Detail null.
  CLEAR: 'clear',
  // One or more open Serious risks. { count, riskIds }.
  SERIOUS_RISK_LIVE: 'serious_risk_live',
  // Red-flagged milestones serving the objective: slipped beyond the
  // tolerance. { milestoneKeys }.
  SLIP_BEYOND_TOLERANCE: 'slip_beyond_tolerance',
  // Amber-flagged milestones serving the objective: slipped against the
  // baseline, within the tolerance. { milestoneKeys }.
  SLIP_AGAINST_BASELINE: 'slip_against_baseline',
  // Time only: the forecast completion is past the stated target.
  // { totalWeeksLate, targetCompletionDate, forecastCompletion }.
  FORECAST_PAST_TARGET: 'forecast_past_target',
});

// The module that acts on each status, for the surface's drill-through. A
// clear objective has nothing to act on, so it routes nowhere.
const ACTS_IN = Object.freeze({
  [LADDER_TRIGGERS.NOT_SCORED]: 'risk',
  [LADDER_TRIGGERS.CLEAR]: null,
  [LADDER_TRIGGERS.SERIOUS_RISK_LIVE]: 'risk',
  [LADDER_TRIGGERS.SLIP_BEYOND_TOLERANCE]: 'programme',
  [LADDER_TRIGGERS.SLIP_AGAINST_BASELINE]: 'programme',
  [LADDER_TRIGGERS.FORECAST_PAST_TARGET]: 'programme',
});

// The objective display names. The engine layer carries types; the driver
// speaks names. Five fixed types, matching objectiveMeta's canonical list.
const NAME_BY_TYPE = Object.freeze({
  scope: 'Scope',
  cost: 'Cost',
  time: 'Time',
  quality: 'Quality',
  funding: 'Funding',
});

// Counts inside sentences are words (the house rule); beyond nine, digits.
const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
];

function numberWord(n) {
  const word = NUMBER_WORDS[n] ?? String(n);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Week figures round to the nearest whole week, never below one: a breach is
// never "0 weeks past".
function weeksPast(x) {
  const n = Math.max(1, Math.round(x));
  return `${n} ${n === 1 ? 'week' : 'weeks'}`;
}

// "30 April 2028": day month year in full, parsed as UTC so a plain date
// string never shifts a day. The dashboard's own date convention.
function formatDate(value) {
  if (value == null) return null;
  const epoch =
    value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (Number.isNaN(epoch)) return null;
  return new Date(epoch).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function objectiveName(type) {
  return NAME_BY_TYPE[type] ?? type ?? 'this objective';
}

// The driver for each trigger: one sentence, the cited fact, no more.
function driverFor(key, detail, name) {
  switch (key) {
    case LADDER_TRIGGERS.NOT_SCORED:
      return `Nothing has been assessed against ${name} yet.`;
    case LADDER_TRIGGERS.CLEAR:
      return `Nothing live threatens ${name}: no Serious risk, no slip beyond tolerance, no breach.`;
    case LADDER_TRIGGERS.SERIOUS_RISK_LIVE:
      return detail.count === 1
        ? `A Serious risk is live against ${name}.`
        : `${numberWord(detail.count)} Serious risks are live against ${name}.`;
    case LADDER_TRIGGERS.SLIP_BEYOND_TOLERANCE:
      return detail.milestoneKeys.length === 1
        ? `A milestone serving ${name} has slipped beyond your tolerance.`
        : `${numberWord(detail.milestoneKeys.length)} milestones serving ${name} have slipped beyond your tolerance.`;
    case LADDER_TRIGGERS.SLIP_AGAINST_BASELINE:
      return detail.milestoneKeys.length === 1
        ? `A milestone serving ${name} has slipped against its baseline date.`
        : `${numberWord(detail.milestoneKeys.length)} milestones serving ${name} have slipped against their baseline dates.`;
    case LADDER_TRIGGERS.FORECAST_PAST_TARGET: {
      const target = formatDate(detail.targetCompletionDate);
      return target == null
        ? `Forecast completes ${weeksPast(detail.totalWeeksLate)} past your target.`
        : `Forecast completes ${weeksPast(detail.totalWeeksLate)} past your ${target} target.`;
    }
    default:
      throw new Error(`objectiveLadder: no driver for trigger key "${key}"`);
  }
}

/**
 * Derive the ladder from deriveObjectiveHealth's output. Returns one row per
 * objective, in the health read's own order:
 *
 *   { id, type, name, classification, isProtected, status, driver,
 *     trigger: { key, detail }, actsIn }
 *
 * actsIn names the module that acts on the status ('risk', 'programme', or
 * null when nothing needs acting on), so the surface can drill through
 * without inventing a route of its own.
 */
export function deriveObjectiveLadder(health) {
  if (health == null || !Array.isArray(health.objectives)) {
    throw new Error('deriveObjectiveLadder: a health read is required');
  }

  return health.objectives.map((row) => {
    const name = objectiveName(row.type);
    const signals = row.signals ?? {};
    const milestones = row.items?.milestones ?? [];
    const risks = row.items?.risks ?? [];
    const dateBreached = row.dateSignal?.verdict === 'past_target';

    let status;
    let key;
    let detail;

    if (dateBreached) {
      // Breach in fact, and it outranks everything including not_scored: a
      // forecast measured against the locked baseline is an assessment.
      status = LADDER_STATUSES.COMPROMISED;
      key = LADDER_TRIGGERS.FORECAST_PAST_TARGET;
      detail = {
        totalWeeksLate: row.dateSignal.totalWeeksLate,
        targetCompletionDate: row.dateSignal.targetCompletionDate,
        forecastCompletion: row.dateSignal.forecastCompletion,
      };
    } else if (row.state === 'not_scored') {
      status = LADDER_STATUSES.NOT_SCORED;
      key = LADDER_TRIGGERS.NOT_SCORED;
      detail = null;
    } else if (signals.programmeFlag === 'red') {
      status = LADDER_STATUSES.SLIPPING;
      key = LADDER_TRIGGERS.SLIP_BEYOND_TOLERANCE;
      detail = {
        milestoneKeys: milestones
          .filter((m) => m.flag === 'red')
          .map((m) => m.key),
      };
    } else if (signals.programmeFlag === 'amber') {
      status = LADDER_STATUSES.SLIPPING;
      key = LADDER_TRIGGERS.SLIP_AGAINST_BASELINE;
      detail = {
        milestoneKeys: milestones
          .filter((m) => m.flag === 'amber')
          .map((m) => m.key),
      };
    } else if (signals.worstRisk === 'serious') {
      status = LADDER_STATUSES.AT_RISK;
      key = LADDER_TRIGGERS.SERIOUS_RISK_LIVE;
      detail = {
        count: signals.seriousCount,
        riskIds: risks
          .filter((r) => r.severity === 'serious')
          .map((r) => r.id),
      };
    } else {
      status = LADDER_STATUSES.HEALTHY;
      key = LADDER_TRIGGERS.CLEAR;
      detail = null;
    }

    return {
      id: row.id,
      type: row.type,
      name,
      classification: row.classification,
      isProtected: row.isProtected,
      status,
      driver: driverFor(key, detail, name),
      trigger: { key, detail },
      actsIn: ACTS_IN[key],
    };
  });
}
