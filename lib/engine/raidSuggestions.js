/**
 * The RAID suggestion engine (Note 7). Deterministic AI enrichment: a
 * suggestion is a FUNCTION OF THE CAPTURED INPUTS, never generated at runtime,
 * and every suggestion traces to the input that produced it.
 *
 * WHAT THIS MODULE IS. A selector over a condition-tagged library
 * (raidLibrary.js) and nothing else. It evaluates each candidate's declared
 * condition against the recorded baseline, substitutes recorded values into the
 * candidate's own wording, resolves the objective dimension the candidate names
 * to the project's own objective of that dimension, and previews the criticality
 * that would derive from it. It computes no figure, no probability and no
 * judgement, because the condition vocabulary gives it nothing to compute with.
 * Given the same baseline it returns the same list in the same order, always.
 *
 * THE THREE RULES IT ENFORCES.
 *
 *   1. NOTHING IS ASSERTED THAT THE INPUTS DO NOT CARRY. A candidate whose text
 *      holds a token that cannot be resolved from the baseline is DROPPED and
 *      recorded in `dropped`, never rendered with a gap or a guess.
 *
 *   2. A PROPOSAL, NEVER A FACT (Task 2, settled 31 Jul 2026). A candidate names
 *      an objective DIMENSION. The engine resolves it to the project's own
 *      objective of that dimension where one exists, and to NO PROPOSAL AT ALL
 *      where none does. It never invents an objective and never forces a link to
 *      an unrelated one. Where a proposal resolves, the would-be criticality is
 *      computed by CALLING Session D's derivation (deriveCaptureStamp), not by
 *      restating the rule here.
 *
 *   3. THE SUGGESTION PATH WRITES NO CRITICALITY OF ITS OWN. suggestionToRow
 *      builds the capture payload with the confirmed link and NO criticality and
 *      NO basis columns. Migration 034's trigger is the sole writer of all three:
 *      it stamps the derivation and hard-rejects a critical the link does not
 *      carry. A payload that carried a value would either be overwritten or
 *      rejected, so sending one is at best noise and at worst a failed insert.
 *
 * GEOGRAPHY. A candidate whose wording touches a jurisdictional mechanism reads
 * that wording from the geography configuration Session F built, through
 * geographyTemplate. There is no country branch in this module and none in the
 * library: the token resolves against whatever expression the project's country
 * produces, and an unconfigured country resolves to the neutral base, never to
 * the United Kingdom.
 *
 * Pure. No DB, no React, no network, no system clock.
 */

import { RAID_LIBRARY, RAID_TYPE_ORDER } from './raidLibrary.js';
import { geographyTemplate, resolveGeography } from './geography.js';
import { buildObjectiveIndex, deriveCaptureStamp } from './criticality.js';
import { STAGE_NAMES } from './stageNames.js';
import { dateParts } from './dateFormat.js';

/**
 * Display wording for the two enum facts the basis names. The values match the
 * Brief's own maps (briefModel.js) verbatim, so a basis line and the Brief say
 * the same words about the same recorded fact. The planning status wording is
 * NOT here: it is geography-dependent and read from the geography configuration.
 */
const FUNDING_STRUCTURE_LABELS = {
  senior_debt: 'Senior debt',
  mezzanine: 'Mezzanine',
  equity: 'Equity',
  jv: 'Joint venture',
  development_finance: 'Development finance',
  bridging: 'Bridging',
  off_plan_presales: 'Off-plan presales',
  self_funded: 'Self-funded',
  grant: 'Grant',
  other: 'Other',
};

const PROCUREMENT_ROUTE_LABELS = {
  design_bid_build: 'Design-Bid-Build',
  design_build: 'Design and Build',
  construction_management: 'Construction Management',
  management_contracting: 'Management Contracting',
  other: 'Other',
};

// Milliseconds in a week, for the one span comparison the vocabulary allows.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// A date carrier as a UTC epoch, or null. Read through the one date reader
// (dateFormat.dateParts) so no timezone can move a recorded day.
function epochOf(value) {
  const parts = dateParts(value);
  if (parts == null) return null;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

/**
 * The recorded window for one stage gate, in weeks, or null when the baseline
 * does not carry it.
 *
 * The window runs from the previous APPLICABLE gate's target date to this
 * gate's. A gate marked not applicable carries the anchor forward (the Step 7
 * rule), so it is skipped rather than treated as a zero-length stage. With no
 * earlier gate at all, the window runs from the recorded project start. A
 * missing date at either end returns null, which makes the clause false: an
 * absent fact never fires a condition.
 */
function recordedStageWindowWeeks(stage, gates, projectStart) {
  const rows = Array.isArray(gates) ? gates : [];
  const self = rows.find((g) => Number(g?.stage) === stage);
  const end = epochOf(self?.target_date);
  if (self == null || self.target_na === true || end == null) return null;

  let start = null;
  for (let s = stage - 1; s >= 0; s -= 1) {
    const prev = rows.find((g) => Number(g?.stage) === s);
    if (prev == null || prev.target_na === true) continue;
    const at = epochOf(prev.target_date);
    if (at != null) {
      start = at;
      break;
    }
  }
  if (start == null) start = epochOf(projectStart);
  if (start == null) return null;

  return (end - start) / WEEK_MS;
}

// The geography-expressed template's curated span for a stage, or null.
function typicalStageWeeks(template, stage) {
  const entry = (template?.stages ?? []).find((s) => s.stage === stage);
  const weeks = entry?.gateWeeks;
  return typeof weeks === 'number' && Number.isFinite(weeks) ? weeks : null;
}

// The stage's location-sensitive hint label from the geography-expressed
// template, or null when the geography configures none for that stage.
function hintLabel(template, stage) {
  const entry = (template?.stages ?? []).find((s) => s.stage === stage);
  const label = entry?.locationSensitive?.[0]?.label;
  return typeof label === 'string' && label !== '' ? label : null;
}

/**
 * Normalise the baseline the selector reads. Every field is a RECORDED fact and
 * names where it is recorded, so a reader can check the claim. Anything absent
 * stays null and makes its clause false.
 *
 * The wizard holds these across several pieces of state by Step 8, so this
 * takes them flat rather than reaching into a shape it does not own.
 */
export function buildRaidBaseline({
  country = null,
  currency = null,
  procurementRoute = null,
  planningStatus = null,
  fundingStructureType = null,
  fundingMilestoneCount = 0,
  entryStage = 1,
  projectStart = null,
  gates = null,
  objectives = null,
  nameByType = null,
} = {}) {
  const entry = Number(entryStage);
  return {
    country: country || null,
    currency: currency || null,
    procurementRoute: procurementRoute || null,
    planningStatus: planningStatus || null,
    fundingStructureType: fundingStructureType || null,
    fundingMilestoneCount: Number(fundingMilestoneCount) || 0,
    // A missing or malformed entry stage reads as the from-scratch Stage 1,
    // exactly as scopeSuggestions already treats it (Note 12).
    entryStage: Number.isInteger(entry) ? entry : 1,
    projectStart: projectStart || null,
    gates: Array.isArray(gates) ? gates : [],
    objectives: Array.isArray(objectives) ? objectives : [],
    nameByType: nameByType ?? null,
  };
}

/**
 * Evaluate one candidate's condition against the baseline.
 *
 * Returns { fires, clauses }: whether every declared clause holds, and the
 * clauses that fired, in the order the vocabulary declares them so the basis
 * reads the same way every time. A clause the candidate omits is not evaluated
 * and contributes nothing.
 *
 * `stagesAhead` is a scoping filter rather than a reason (Note 12), so it gates
 * the candidate but is never returned as a clause.
 */
function evaluate(candidate, baseline, context) {
  const when = candidate.when ?? {};
  const clauses = [];
  const { byType, geography, template } = context;

  const oneOf = (value, allowed) =>
    value != null && Array.isArray(allowed) && allowed.includes(value);

  // The stage scope (Note 12), evaluated first and held back until the end.
  // Every candidate that carries one is filtered by it, so stating it alongside
  // a substantive reason would be noise on every card. A candidate selected on
  // NOTHING ELSE must still say what selected it, so the clause is worded only
  // when nothing else fired, and the recorded input it names is the project's
  // own entry stage.
  let stageAheadClause = null;
  if (when.stagesAhead !== undefined) {
    const ahead = (Array.isArray(when.stagesAhead) ? when.stagesAhead : [])
      .filter((s) => s >= baseline.entryStage)
      .sort((a, b) => a - b);
    if (ahead.length === 0) return { fires: false, clauses: [] };
    const first = ahead[0];
    const name = STAGE_NAMES[first];
    if (name) {
      stageAheadClause = {
        fact: 'entry_stage',
        text: `Stage ${first}, ${name}, is still ahead on this project`,
      };
    }
  }

  if (when.countryIn !== undefined) {
    if (!oneOf(baseline.country, when.countryIn)) return { fires: false, clauses: [] };
    clauses.push({
      fact: 'country',
      text: `the project country is ${geography.label}`,
    });
  }

  if (when.currencyIn !== undefined) {
    if (!oneOf(baseline.currency, when.currencyIn)) return { fires: false, clauses: [] };
    clauses.push({
      fact: 'currency',
      text: `the reporting currency is ${baseline.currency}`,
    });
  }

  if (when.fundingStructureIn !== undefined) {
    if (!oneOf(baseline.fundingStructureType, when.fundingStructureIn)) {
      return { fires: false, clauses: [] };
    }
    const label = FUNDING_STRUCTURE_LABELS[baseline.fundingStructureType];
    if (!label) return { fires: false, clauses: [] };
    clauses.push({
      fact: 'funding_structure',
      text: `the funding structure is ${label.toLowerCase()}`,
    });
  }

  if (when.procurementRouteIn !== undefined) {
    if (!oneOf(baseline.procurementRoute, when.procurementRouteIn)) {
      return { fires: false, clauses: [] };
    }
    const label = PROCUREMENT_ROUTE_LABELS[baseline.procurementRoute];
    if (!label) return { fires: false, clauses: [] };
    clauses.push({
      fact: 'procurement_route',
      text: `the procurement route is ${label}`,
    });
  }

  if (when.planningStatusIn !== undefined) {
    if (!oneOf(baseline.planningStatus, when.planningStatusIn)) {
      return { fires: false, clauses: [] };
    }
    // The field's name and its option wording both come from the geography
    // configuration, so this reads "the consent status" in Nigeria and "the
    // planning status" in the United Kingdom without a branch here.
    const option = geography.planningStatusLabels?.[baseline.planningStatus];
    if (!option) return { fires: false, clauses: [] };
    clauses.push({
      fact: 'planning_status',
      text: `the ${geography.planningStatusLabel.toLowerCase()} is "${option}"`,
    });
  }

  if (when.hasFundingMilestones !== undefined) {
    const has = baseline.fundingMilestoneCount > 0;
    if (has !== when.hasFundingMilestones) return { fires: false, clauses: [] };
    if (has) {
      clauses.push({
        fact: 'funding_milestones',
        text: 'the project records funding milestones',
      });
    }
  }

  for (const [key, wanted] of [
    ['nonNegotiable', 'non_negotiable'],
    ['flexible', 'flexible'],
  ]) {
    if (when[key] === undefined) continue;
    const types = Array.isArray(when[key]) ? when[key] : [];
    const names = [];
    for (const type of types) {
      const objective = byType[type];
      if (!objective || objective.classification !== wanted) {
        return { fires: false, clauses: [] };
      }
      // The basis names the objective, so it needs the objective's own display
      // name. The kernel holds none of its own, so an unnamed objective cannot
      // be worded and the candidate does not fire.
      if (!objective.name) return { fires: false, clauses: [] };
      names.push(objective.name);
    }
    if (names.length > 0) {
      const list =
        names.length === 1
          ? names[0]
          : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      const verb = names.length === 1 ? 'is' : 'are';
      // "on this project" belongs on the non-negotiable clause, which is the one
      // that confers criticality and so has to be attributed. Repeating it on a
      // flexible clause beside it just says the same thing twice.
      const tail =
        wanted === 'non_negotiable' ? 'non-negotiable on this project' : 'flexible';
      clauses.push({
        fact: key === 'nonNegotiable' ? 'non_negotiable' : 'flexible',
        text: `${list} ${verb} ${tail}`,
      });
    }
  }

  if (when.stageUnderTypical !== undefined) {
    const stage = when.stageUnderTypical;
    const recorded = recordedStageWindowWeeks(
      stage,
      baseline.gates,
      baseline.projectStart
    );
    const typical = typicalStageWeeks(template, stage);
    if (recorded == null || typical == null || !(recorded < typical)) {
      return { fires: false, clauses: [] };
    }
    const name = STAGE_NAMES[stage];
    if (!name) return { fires: false, clauses: [] };
    clauses.push({
      fact: 'stage_window',
      text: `the dates recorded for Stage ${stage}, ${name}, leave it a shorter window than the template's own span`,
    });
  }

  if (clauses.length === 0 && stageAheadClause) clauses.push(stageAheadClause);

  return { fires: true, clauses };
}

/**
 * Substitute a candidate's tokens from the baseline. Returns the rendered text,
 * or null when any token cannot be resolved, which drops the candidate. This is
 * the rule that keeps a suggestion from asserting something the inputs do not
 * carry: a gap is never rendered and a value is never invented to fill one.
 */
function render(text, baseline, context) {
  let unresolved = false;
  const out = String(text).replace(/\{\{([a-z]+)(?::([^}]+))?\}\}/g, (_, name, arg) => {
    let value = null;
    if (name === 'hint') {
      value = hintLabel(context.template, Number(arg));
    } else if (name === 'currency') {
      value = baseline.currency;
    } else if (name === 'stage') {
      value = STAGE_NAMES[Number(arg)] ?? null;
    }
    if (value == null || value === '') {
      unresolved = true;
      return '';
    }
    return value;
  });
  return unresolved ? null : out;
}

/**
 * The basis line: the recorded input or inputs that fired this candidate, in
 * the form B3 already uses on the monitoring modules (playbookModel.playBasis).
 * B3 says "Stage 2 playbook, selected because Cost is non-negotiable on this
 * project"; this says the same thing about the inputs that actually fired.
 *
 * EVERY candidate names a recorded input, by construction: a candidate whose
 * only clause is the stage scope words that scope (the project's own entry
 * stage), and a candidate with no clause at all cannot be selected, because
 * evaluate returns clauses for exactly the facts it tested. So there is no
 * basis-less branch here to fall through to.
 */
function basisLine(clauses) {
  const list =
    clauses.length === 1
      ? clauses[0].text
      : `${clauses
          .slice(0, -1)
          .map((c) => c.text)
          .join(', ')}, and ${clauses[clauses.length - 1].text}`;
  return `PULSE Suggests, selected because ${list}.`;
}

/**
 * The proposal for a candidate (Task 2). Resolves the candidate's objective
 * DIMENSION to the project's own objective of that dimension, and previews the
 * criticality that would derive from it.
 *
 * Returns null where the project holds no objective of that dimension, which is
 * the whole point: the engine never invents an objective and never forces a
 * link to an unrelated one. The card then carries no proposal at all.
 *
 * The would-be criticality is Session D's own derivation, CALLED not restated:
 * a non-negotiable objective gives Critical, a flexible objective gives
 * Standard, and the same call supplies the basis the trigger will record.
 */
function proposalFor(dimension, byType, byId) {
  const objective = dimension ? byType[dimension] : null;
  if (!objective || !objective.id) return null;
  const stamp = deriveCaptureStamp(objective.id, byId);
  return {
    objectiveId: objective.id,
    objectiveType: objective.type,
    objectiveName: objective.name ?? null,
    classification: objective.classification ?? null,
    criticality: stamp.criticality,
  };
}

/**
 * Derive the candidate RAID items for one baseline.
 *
 * Returns { candidates, dropped }:
 *
 *   candidates  [{ key, type, dimension, text, basis, basisFacts, proposal }]
 *               in a stable order: RAID type (risk, assumption, constraint,
 *               dependency), then the library's own declaration order within a
 *               type. Both are fixed data, so the order is a property of the
 *               library rather than of anything derived, and the same baseline
 *               returns the same list in the same order every time.
 *
 *   dropped     [{ key, reason }] for every candidate whose condition held but
 *               whose text could not be expressed from the baseline. Reported
 *               rather than swallowed, because a candidate that cannot be
 *               honestly worded is a gap in the library, not a non-event.
 *
 * `library` is injectable so a test can pin the mechanism without depending on
 * the shipped content.
 */
export function deriveRaidSuggestions(baseline, library = RAID_LIBRARY) {
  const base = baseline ?? buildRaidBaseline();
  const { byId, byType } = buildObjectiveIndex(base.objectives, base.nameByType);
  const context = {
    byType,
    geography: resolveGeography(base.country),
    template: geographyTemplate(base.country),
  };

  const candidates = [];
  const dropped = [];

  for (const candidate of library ?? []) {
    const { fires, clauses } = evaluate(candidate, base, context);
    if (!fires) continue;

    // Every suggestion traces to the input that produced it. A candidate that
    // tested no recorded fact has nothing to trace to, so it is not offered.
    // This is structural rather than a convention: a library entry with an
    // empty condition cannot reach a card.
    if (clauses.length === 0) {
      dropped.push({ key: candidate.key, reason: 'no_recorded_basis' });
      continue;
    }

    const text = render(candidate.text, base, context);
    if (text == null) {
      dropped.push({ key: candidate.key, reason: 'unresolved_token' });
      continue;
    }

    candidates.push({
      key: candidate.key,
      type: candidate.type,
      dimension: candidate.dimension,
      text,
      basis: basisLine(clauses),
      basisFacts: clauses.map((c) => c.fact),
      proposal: proposalFor(candidate.dimension, byType, byId),
    });
  }

  const rank = (type) => {
    const i = RAID_TYPE_ORDER.indexOf(type);
    return i === -1 ? RAID_TYPE_ORDER.length : i;
  };
  // Array.prototype.sort is stable, so ties keep the library's declaration
  // order and the whole ordering stays a property of the library.
  candidates.sort((a, b) => rank(a.type) - rank(b.type));

  return { candidates, dropped };
}

/**
 * The candidates grouped by RAID type, for the four Step 8 lists. Every type
 * gets a key, so a list with no candidates renders its own empty state rather
 * than the surface having to guess whether the engine ran.
 */
export function groupByType(candidates) {
  const grouped = {};
  for (const type of RAID_TYPE_ORDER) grouped[type] = [];
  for (const c of candidates ?? []) {
    if (grouped[c.type]) grouped[c.type].push(c);
  }
  return grouped;
}

/**
 * The Step 8 list key each RAID type captures into. The engine names the type;
 * the surface owns the tables and the item shape (listItemModel.suggestionToItem),
 * so this is the one join between them and it lives here rather than being
 * restated per call site.
 */
export const LIST_KEY_BY_TYPE = Object.freeze({
  risk: 'risks',
  assumption: 'assumptions',
  constraint: 'constraints',
  dependency: 'dependencies',
});
