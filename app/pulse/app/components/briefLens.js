/**
 * Audience lens configuration for the PULSE Brief (Step 8).
 *
 * The lens does three things (M3.5 spec):
 *   1. Re-orders the sections (SECTION_ORDER).
 *   2. Swaps the executive summary (buildSummaries), leading on what the
 *      audience cares about.
 *   3. Gates which financial figures are visible (showsProjected): the
 *      Design Consultant never sees Projected GDV, Projected ROI, or the
 *      appraisal link. Budget (allotted) is visible to all.
 *
 * The summary is assembled from the developer's own data only. A generated
 * opening states the facts and a brief computed posture (the PULSE read
 * carries the interpretation); a funding line is added for Lender and JV
 * only; then the developer's Strategic Context (rationale, exit) is shown
 * verbatim. Every clause is conditional, so a sparsely filled project yields
 * a short, honest summary rather than invented prose. The generated opening
 * obeys the same figure gating, so the Consultant summary never carries GDV
 * or ROI.
 *
 * Punctuation discipline: no em dashes or en dashes.
 */

import { formatCurrency, formatPercent, formatList } from './briefFormat';

// The three lenses, in the order the selector presents them.
export const LENSES = [
  { key: 'lender', label: 'Lender' },
  { key: 'jv', label: 'JV Partner' },
  { key: 'consultant', label: 'Design Consultant' },
];

export const DEFAULT_LENS = 'lender';

export function isLens(value) {
  return LENSES.some((l) => l.key === value);
}

// Section order per lens. 'summary' always leads; the rest reorder to put
// what each audience reads first near the top. Keys map to the brief's
// sections: summary, objectives, read, risk, programme (milestones), ws
// (workstreams), funding (financials).
export const SECTION_ORDER = {
  lender: ['summary', 'funding', 'risk', 'objectives', 'scope', 'org', 'read', 'programme', 'ws'],
  jv: ['summary', 'objectives', 'read', 'scope', 'funding', 'org', 'ws', 'risk', 'programme'],
  consultant: ['summary', 'objectives', 'scope', 'programme', 'ws', 'org', 'risk', 'funding', 'read'],
};

// Section heading and optional right-aligned subtitle.
export const SECTION_META = {
  summary: { title: 'Executive summary' },
  objectives: {
    title: 'Objectives and what they will bear',
    subtitle: 'Ranked by priority',
  },
  read: {
    title: 'The PULSE read',
    subtitle: 'Derived from this project, not boilerplate',
  },
  scope: { title: 'Scope and site', subtitle: 'What is built, and where' },
  org: {
    title: 'Organisation and governance',
    subtitle: 'Parties, authority, and reporting',
  },
  risk: {
    title: 'Risks, assumptions, constraints and dependencies',
    subtitle: 'Critical items flagged in amber',
  },
  programme: {
    title: 'Programme',
    subtitle: 'Stage gates and critical milestones',
  },
  ws: { title: 'Workstreams and accountability' },
  funding: { title: 'Financials', subtitle: 'Headline figures, not a model' },
};

// The lens note shown under the document header.
export const LENS_NOTE = {
  lender:
    'You are viewing the Lender lens. It leads with funding, the risk posture, and the objectives the facility depends on.',
  jv:
    'You are viewing the JV Partner lens. It leads with the governance posture, who is accountable, and the projected return.',
  consultant:
    'You are viewing the Design Consultant lens. It leads with the protected objectives, the programme, and the workstreams the design must serve.',
};

// Whether projected figures (GDV, ROI) and the appraisal link are visible.
// Budget (allotted) is non-gated and handled separately.
export function showsProjected(lens) {
  return lens !== 'consultant';
}

// ── Executive summary assembly ─────────────────────────────────────────────

function factsSentence(facts) {
  const typeClause = facts.projectType
    ? ` a ${facts.projectType.toLowerCase()} development`
    : ' a development';
  const place = [facts.location, facts.countryLabel].filter(Boolean).join(', ');
  const locClause = place ? ` in ${place}` : '';
  return `${facts.name} is${typeClause}${locClause}.`;
}

function sizeSentence(facts) {
  return facts.size ? `It comprises ${facts.size}.` : '';
}

// Brief computed posture. Deliberately short: the PULSE read does the
// interpreting.
function postureSentence(facts) {
  const nn = facts.protected.length;
  if (nn === 5) return 'Every objective is fixed as non-negotiable.';
  if (nn === 0) return 'Every objective is held flexible.';
  const protectedNames = facts.protected.map((o) => o.name);
  const flexibleNames = facts.flexible.map((o) => o.name);
  return `It protects ${formatList(protectedNames)} and flexes ${formatList(flexibleNames)}.`;
}

// Funding line from entered financials (Lender and JV only). Names only the
// figures the developer entered.
function fundingLine(facts) {
  const { budget, projectedGdv, projectedRoi, currency } = facts.financials;
  const pieces = [];
  if (budget != null) pieces.push(`a budget of ${formatCurrency(budget, currency)}`);
  if (projectedGdv != null) {
    pieces.push(`a projected GDV of ${formatCurrency(projectedGdv, currency)}`);
  }
  if (projectedRoi != null) {
    pieces.push(`a projected return of ${formatPercent(projectedRoi)}`);
  }
  if (pieces.length === 0) return '';
  return `The brief sets out ${formatList(pieces)}.`;
}

// The developer's Strategic Context, verbatim, as trailing paragraphs.
function contextParagraphs(facts) {
  return [facts.strategicRationale, facts.exitStrategy]
    .map((s) => (s ? String(s).trim() : ''))
    .filter(Boolean);
}

function compose(parts) {
  return parts.map((p) => (p ? p.trim() : '')).filter(Boolean);
}

/**
 * Build the three lens summaries. Each is an array of paragraph strings.
 * Order of the generated second paragraph differs by lens (funding-led for
 * Lender, posture-led for JV), and the Consultant gets no funding line.
 */
export function buildSummaries(facts) {
  const lead = compose([factsSentence(facts), sizeSentence(facts)]).join(' ');
  const posture = postureSentence(facts);
  const funding = fundingLine(facts);
  const context = contextParagraphs(facts);

  return {
    lender: compose([lead, compose([funding, posture]).join(' '), ...context]),
    jv: compose([lead, compose([posture, funding]).join(' '), ...context]),
    // Consultant: posture only, no funding line (gating).
    consultant: compose([lead, posture, ...context]),
  };
}
