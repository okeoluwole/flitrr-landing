/**
 * Brief assembly for Step 8.
 *
 * assembleBrief() takes the wizard's live state (the same in-memory state
 * that drives Steps 1 to 7) and produces a single, lens-independent model
 * the brief renders from. Nothing is invented: every field traces to the
 * developer's data. The model carries display-ready strings (currency,
 * dates, percentages) and the derived intelligence (insights, the three
 * lens summaries), so a locked snapshot of this object renders identically
 * forever, regardless of later code changes.
 *
 * The lens (ordering, summary choice, financial gating) is applied at
 * render time in BriefDocument, not here, so one model serves all three
 * lenses for both the live preview and the locked rendering.
 *
 * Only real, non-blank list items are included (the same identity-field
 * rule the wizard uses when persisting), so the brief matches what is saved.
 */

import { OBJECTIVE_META, OBJECTIVE_ORDER } from './objectiveMeta';
import { toNumber, formatCurrency, formatPercent, formatMonthYear } from './briefFormat';
import { computeInsights } from './pulseRead';
import { buildSummaries } from './briefLens';

// Current snapshot schema. Bump if the model shape changes in a way a locked
// brief's renderer must branch on.
export const BRIEF_SCHEMA_VERSION = 1;

const NAME_BY_TYPE = Object.fromEntries(
  OBJECTIVE_META.map((o) => [o.type, o.name])
);

// Allowed reporting currencies (the project_currency enum). An unexpected or
// missing value falls back to GBP, matching the column default.
const CURRENCIES = ['GBP', 'NGN', 'USD'];
function validCurrency(v) {
  return CURRENCIES.includes(v) ? v : 'GBP';
}

// Trim to a non-empty string, or null.
function t(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Order milestones by target date ascending, undated last, stable within
// ties (preserves entry order).
function byDate(items) {
  return items
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const da = a.m.date;
      const db = b.m.date;
      if (da && db) return da < db ? -1 : da > db ? 1 : a.i - b.i;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return a.i - b.i;
    })
    .map((x) => x.m);
}

/**
 * Normalise the raw wizard state into the `facts` object the read ruleset
 * and the summaries consume. Objectives are ranked by the live Step 4 order;
 * list items are filtered to the real (non-blank) ones.
 */
function normalizeFacts({ def, ctx, objectives, rankOrder, lists }) {
  const order = rankOrder && rankOrder.length ? rankOrder : [...OBJECTIVE_ORDER];
  const rankOf = (type) => {
    const i = order.indexOf(type);
    return i === -1 ? order.length + 1 : i + 1;
  };

  const objs = (objectives ?? [])
    .map((o) => ({
      id: o.id,
      type: o.objective_type,
      name: NAME_BY_TYPE[o.objective_type] ?? o.objective_type,
      classification: o.classification,
      definition: t(o.definition),
      // Non-negotiable objectives carry no tolerance (the wizard stores null).
      tolerance: o.classification === 'flexible' ? t(o.tolerance) : null,
      rank: rankOf(o.objective_type),
    }))
    .sort((a, b) => a.rank - b.rank);

  const objectiveById = Object.fromEntries(objs.map((o) => [o.id, o]));

  const rawLists = lists ?? { milestones: [], workstreams: [], risks: [] };

  const milestones = (rawLists.milestones ?? [])
    .filter((m) => t(m.name))
    .map((m) => ({
      name: t(m.name),
      date: t(m.target_date),
      critical: m.criticality === 'critical',
      linkedId: m.linked_objective_id || null,
    }));

  const workstreams = (rawLists.workstreams ?? [])
    .filter((w) => t(w.name))
    .map((w) => ({
      name: t(w.name),
      lead: t(w.lead),
      critical: w.criticality === 'critical',
      linkedId: w.linked_objective_id || null,
    }));

  const risks = (rawLists.risks ?? [])
    .filter((r) => t(r.description))
    .map((r, i) => ({
      num: i + 1,
      description: t(r.description),
      critical: r.criticality === 'critical',
      linkedId: r.linked_objective_id || null,
      likelihood: t(r.likelihood),
      impact: t(r.impact),
      mitigation: t(r.mitigation),
    }));

  return {
    name: t(def?.name) ?? 'Untitled project',
    projectType: t(def?.project_type),
    category: t(def?.category),
    size: t(def?.size),
    location: t(def?.location),
    description: t(def?.description),
    targetCompletion: t(def?.target_completion_date),
    strategicRationale: t(ctx?.strategic_rationale),
    exitStrategy: t(ctx?.exit_strategy),
    targetEndUser: t(ctx?.target_end_user),
    strategicAlignment: t(ctx?.strategic_alignment),
    financials: {
      currency: validCurrency(def?.currency),
      budget: toNumber(def?.budget),
      projectedGdv: toNumber(def?.projected_gdv),
      projectedRoi: toNumber(def?.projected_roi),
      detailUrl: t(def?.financial_detail_url),
    },
    objectives: objs,
    objectiveById,
    protected: objs.filter((o) => o.classification === 'non_negotiable'),
    flexible: objs.filter((o) => o.classification === 'flexible'),
    milestones,
    workstreams,
    risks,
  };
}

// Risk matrix axes. Likelihood runs low to high across columns; impact runs
// high to low down the rows (high impact at the top, as in the prototype).
const LIKELIHOODS = ['low', 'medium', 'high'];
const IMPACTS = ['high', 'medium', 'low'];

function buildRiskMatrix(risks) {
  const cells = {};
  for (const imp of IMPACTS) {
    for (const lik of LIKELIHOODS) cells[`${imp}-${lik}`] = [];
  }
  const unrated = [];
  for (const r of risks) {
    const rated =
      LIKELIHOODS.includes(r.likelihood) && IMPACTS.includes(r.impact);
    if (rated) {
      cells[`${r.impact}-${r.likelihood}`].push({ num: r.num, critical: r.critical });
    } else {
      unrated.push(r.num);
    }
  }
  const ratedCount = risks.length - unrated.length;
  return { cells, unrated, hasRated: ratedCount > 0, likelihoods: LIKELIHOODS, impacts: IMPACTS };
}

/**
 * Assemble the full, lens-independent brief model from the wizard state.
 */
export function assembleBrief(state) {
  const facts = normalizeFacts(state);
  const { currency } = facts.financials;

  const nn = facts.protected.length;
  const criticalRiskCount = facts.risks.filter((r) => r.critical).length;

  const kpis = [
    {
      key: 'budget',
      label: 'Budget (allotted)',
      value: formatCurrency(facts.financials.budget, currency),
    },
    { key: 'size', label: 'Size', value: facts.size },
    {
      key: 'completion',
      label: 'Target completion',
      value: formatMonthYear(facts.targetCompletion),
    },
    { key: 'protected', label: 'Protected objectives', value: `${nn} of 5` },
    { key: 'risks', label: 'Critical risks', value: String(criticalRiskCount) },
  ];

  const subtitle = [facts.size, facts.location].filter(Boolean).join(', ') || null;

  const milestones = byDate(facts.milestones).map((m) => ({
    name: m.name,
    dateDisplay: formatMonthYear(m.date),
    critical: m.critical,
  }));

  const workstreams = facts.workstreams.map((w) => ({
    name: w.name,
    lead: w.lead,
    critical: w.critical,
    servesName: w.linkedId ? facts.objectiveById[w.linkedId]?.name ?? null : null,
  }));

  const riskList = facts.risks.map((r) => ({
    num: r.num,
    description: r.description,
    critical: r.critical,
    servesName: r.linkedId ? facts.objectiveById[r.linkedId]?.name ?? null : null,
    mitigation: r.mitigation,
    likelihood: r.likelihood,
    impact: r.impact,
    rated: LIKELIHOODS.includes(r.likelihood) && IMPACTS.includes(r.impact),
  }));

  return {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    identity: {
      name: facts.name,
      subtitle,
      stageLabel: 'Stage 1 of 8',
    },
    kpis,
    financials: {
      currency,
      budget: {
        present: facts.financials.budget != null,
        display: formatCurrency(facts.financials.budget, currency),
      },
      projectedGdv: {
        present: facts.financials.projectedGdv != null,
        display: formatCurrency(facts.financials.projectedGdv, currency),
      },
      projectedRoi: {
        present: facts.financials.projectedRoi != null,
        display: formatPercent(facts.financials.projectedRoi),
      },
      detailUrl: facts.financials.detailUrl,
    },
    objectives: {
      counts: { nonNegotiable: nn, flexible: facts.flexible.length, total: facts.objectives.length },
      protected: facts.protected.map((o) => ({
        name: o.name,
        rank: o.rank,
        definition: o.definition,
      })),
      flexible: facts.flexible.map((o) => ({
        name: o.name,
        rank: o.rank,
        definition: o.definition,
        tolerance: o.tolerance,
      })),
    },
    milestones,
    workstreams,
    risks: {
      list: riskList,
      matrix: buildRiskMatrix(facts.risks),
      criticalCount: criticalRiskCount,
    },
    insights: computeInsights(facts),
    summariesByLens: buildSummaries(facts),
  };
}
