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
// brief's renderer must branch on. Bumped to 2 in S10: the model now carries
// the widened sections (scope and site, organisation, the fuller financials,
// the stage gate dates, and the full RAID). Locked v1 snapshots predate these
// keys; the renderer drops any section whose data is absent, so they keep
// rendering unchanged.
export const BRIEF_SCHEMA_VERSION = 2;

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

// ── Controlled-vocabulary labels (S10) ─────────────────────────────────────
// The brief bakes display strings into the snapshot, so it resolves the enums
// to labels at assembly time. These mirror the step components; the brief is
// the delivered-document layer and renders self-contained.

const COUNTRY_LABELS = {
  united_kingdom: 'United Kingdom',
  nigeria: 'Nigeria',
  other: 'Other',
};

// Planning status reads in planning-permission terms for the UK, consent terms
// elsewhere (framework Section 7), matching Step 4's tailoring.
const PLANNING_LABELS = {
  no_application: 'No application yet',
  pre_application: 'Pre-application',
  outline_consent: 'Outline consent',
  full_consent: 'Full consent',
  reserved_matters: 'Reserved matters',
  approved: 'Approved',
  refused: 'Refused',
  other: 'Other',
};
const PLANNING_LABELS_UK = {
  ...PLANNING_LABELS,
  outline_consent: 'Outline planning permission',
  full_consent: 'Full planning permission',
};

const ROLE_LABELS = {
  developer: 'Developer',
  funder: 'Funder',
  project_manager: 'Project manager',
  consultant: 'Consultant',
  contractor: 'Contractor',
  other: 'Other',
};

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

const FM_STATUS_LABELS = { planned: 'Planned', secured: 'Secured', drawn: 'Drawn' };

// Lifecycle stage names (framework Section 4), for the stage gate dates.
const STAGE_NAMES = {
  0: 'Land and Site Acquisition',
  1: 'Project Objectives and Funding',
  2: 'Consultant Appointment',
  3: 'Design and Planning Approvals',
  4: 'Contractor Procurement',
  5: 'Construction',
  6: 'Completion and Handover',
  7: 'Sales and Disposal',
};

/**
 * A compact size display from the structured measures (Step 1), falling back
 * to the legacy free-text size for projects entered before the measures
 * existed. Units and storeys are lightly pluralised; the area and plot values
 * carry their own units as the developer typed them.
 */
function buildSizeDisplay(def) {
  const uc = t(def?.size_unit_count);
  const gia = t(def?.size_gross_internal_area);
  const plot = t(def?.size_plot_size);
  const storeys = t(def?.size_storeys);
  const parts = [];
  if (uc) parts.push(`${uc} ${uc === '1' ? 'unit' : 'units'}`);
  if (gia) parts.push(`${gia} GIA`);
  if (storeys) parts.push(`${storeys} ${storeys === '1' ? 'storey' : 'storeys'}`);
  if (plot) parts.push(`${plot} plot`);
  return parts.length > 0 ? parts.join(', ') : t(def?.size);
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
    size: buildSizeDisplay(def),
    location: t(def?.location),
    countryLabel: def?.country ? COUNTRY_LABELS[def.country] ?? null : null,
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
 * Build the widened sections (S10) from the raw wizard state: scope and site,
 * organisation and governance, the stage gate dates, the fuller financials,
 * and the RAID siblings. Each carries display-ready strings plus a hasContent
 * flag or an array the renderer uses to drop empty sections. Snapshotted with
 * the rest of the model, so a locked brief renders these identically forever.
 */
function buildExtras({ def, scope, org, stakeholders, financial, lists, gates }, facts) {
  const currency = facts.financials.currency;

  // Scope and site.
  const mix = (scope?.mix ?? [])
    .map((m) => ({ label: t(m.label), quantum: t(m.quantum) }))
    .filter((m) => m.label || m.quantum);
  const planningLabels =
    def?.country === 'united_kingdom' ? PLANNING_LABELS_UK : PLANNING_LABELS;
  const scopeSite = {
    developmentSummary: t(scope?.development_summary),
    mix,
    specStandard: t(scope?.spec_standard),
    siteArea: t(scope?.site_area),
    planningStatus: scope?.planning_status
      ? planningLabels[scope.planning_status] ?? null
      : null,
    planningConstraints: t(scope?.planning_constraints),
    physicalConstraints: t(scope?.physical_constraints),
  };
  scopeSite.hasContent = !!(
    scopeSite.developmentSummary ||
    mix.length ||
    scopeSite.specStandard ||
    scopeSite.siteArea ||
    scopeSite.planningStatus ||
    scopeSite.planningConstraints ||
    scopeSite.physicalConstraints
  );

  // Organisation and governance. The named authority is the party the wizard
  // marked by client key.
  const parties = (stakeholders ?? [])
    .filter((p) => t(p.name))
    .map((p) => ({
      name: t(p.name),
      organisation: t(p.organisation),
      role: ROLE_LABELS[p.role] ?? null,
      isAuthority: org?.authority_key ? p._key === org.authority_key : false,
    }));
  const authority = parties.find((p) => p.isAuthority) ?? null;
  const organisation = {
    parties,
    authorityName: authority
      ? authority.organisation
        ? `${authority.name}, ${authority.organisation}`
        : authority.name
      : null,
    reportingCadence: t(org?.reporting_cadence),
    digestRecipient: t(org?.digest_recipient),
  };
  organisation.hasContent = !!(
    parties.length ||
    organisation.reportingCadence ||
    organisation.digestRecipient
  );

  // Stage gate dates (only the gates the developer dated), in stage order.
  const gateDates = (gates ?? [])
    .filter((g) => t(g.target_date))
    .map((g) => ({
      stage: g.stage,
      stageName: STAGE_NAMES[g.stage] ?? `Stage ${g.stage}`,
      dateDisplay: formatMonthYear(g.target_date),
    }))
    .sort((a, b) => a.stage - b.stage);

  // The fuller financials: the breakdown, the funding structure, the milestones.
  const breakdown = [
    { k: 'Hard cost', v: formatCurrency(financial?.hard_cost, currency) },
    { k: 'Soft cost', v: formatCurrency(financial?.soft_cost, currency) },
    { k: 'Contingency', v: formatCurrency(financial?.contingency, currency) },
  ].filter((x) => x.v != null);
  const fundingMilestones = (financial?.milestones ?? [])
    .filter((m) => t(m.label))
    .map((m) => ({
      label: t(m.label),
      amount: formatCurrency(m.amount, currency),
      dateDisplay: formatMonthYear(m.target_date),
      status: m.status ? FM_STATUS_LABELS[m.status] ?? null : null,
    }));
  const financialDetail = {
    breakdown,
    fundingStructure: financial?.funding_structure_type
      ? FUNDING_STRUCTURE_LABELS[financial.funding_structure_type] ?? null
      : null,
    fundingNotes: t(financial?.funding_notes),
    milestones: fundingMilestones,
  };
  financialDetail.hasContent = !!(
    breakdown.length ||
    financialDetail.fundingStructure ||
    financialDetail.fundingNotes ||
    fundingMilestones.length
  );

  // RAID siblings (assumptions, constraints, dependencies). Same shape as the
  // risk list: numbered, with a critical flag and the objective each serves.
  const acdList = (items) =>
    (items ?? [])
      .filter((x) => t(x.description))
      .map((x, i) => ({
        num: i + 1,
        description: t(x.description),
        detail: t(x.detail),
        critical: x.criticality === 'critical',
        servesName: x.linked_objective_id
          ? facts.objectiveById[x.linked_objective_id]?.name ?? null
          : null,
      }));
  const raid = {
    assumptions: acdList(lists?.assumptions),
    constraints: acdList(lists?.constraints),
    dependencies: acdList(lists?.dependencies),
  };

  return { scopeSite, organisation, gateDates, financialDetail, raid };
}

/**
 * Assemble the full, lens-independent brief model from the wizard state.
 */
export function assembleBrief(state) {
  const facts = normalizeFacts(state);
  const { currency } = facts.financials;
  const extras = buildExtras(state, facts);

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

  const locationDisplay = [facts.location, facts.countryLabel]
    .filter(Boolean)
    .join(', ');
  const subtitle =
    [facts.size, locationDisplay].filter(Boolean).join(', ') || null;

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
    // Widened sections (S10). The renderer drops any that have no content, so a
    // sparse project and a locked v1 snapshot (which lack these keys) both read
    // cleanly.
    scopeSite: extras.scopeSite,
    organisation: extras.organisation,
    gateDates: extras.gateDates,
    financialDetail: extras.financialDetail,
    raid: extras.raid,
    insights: computeInsights(facts),
    summariesByLens: buildSummaries(facts),
  };
}
