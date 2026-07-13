/**
 * The STACK Excel workbook model (Bucket 3.5). A pure mapping from an engine
 * result and its meta to the values-only sheet definitions the xlsx writer
 * takes. Six sheets: the report surfaces in their on-screen order (Summary,
 * Cashflow, Comparison, Sensitivity), then the complete input set the run was
 * computed from, then the notes with the provenance, the licence line, and the
 * three reconciliation invariants.
 *
 * Every cell is a string or a number. No formulas exist anywhere in this
 * model or in the writer, so the workbook carries the computed figures only
 * and the model itself stays on the platform.
 *
 * Client-safe imports only (the input contract and the form model); the
 * builder itself runs inside the export server action.
 */

import {
  FUNDING_STRATEGY,
  resolveCurrencySymbol,
} from '../../lib/stack/engine/inputs.js';
import { SECTIONS } from './formModel.js';

// Cell constructors. A null or undefined value reads "n/a", matching the
// engine's undefined figures and the on-screen views.
const isBlank = (v) => v === null || v === undefined || Number.isNaN(v);
const bold = (v) => ({ v, style: 'bold' });
const money = (v) => (isBlank(v) ? 'n/a' : { v, style: 'money' });
const moneyBold = (v) => (isBlank(v) ? 'n/a' : { v, style: 'moneyBold' });
const percent = (v) => (isBlank(v) ? 'n/a' : { v, style: 'percent' });
const multiple = (v) => (isBlank(v) ? 'n/a' : { v, style: 'multiple' });
const number = (v) => (isBlank(v) ? 'n/a' : v);

const USES_LABELS = {
  landAtValue: 'Land (at value)',
  sdlt: 'SDLT',
  construction: 'Construction',
  professionalFees: 'Professional fees',
  statutory: 'Statutory',
  acquisitionLegal: 'Acquisition and legal',
  devManagementFee: 'Development management fee',
};

const SOURCES_LABELS = {
  seniorDebt: 'Senior debt',
  mezzanine: 'Mezzanine',
  presaleReceipts: 'Pre-sale receipts',
  sponsorEquity: 'Sponsor equity',
  partnerEquity: 'Funding partner equity',
  contributedLand: 'Contributed land',
};

// The calendar label for a month offset from the commencement date, matching
// the on-screen cashflow header.
function monthLabel(commencementISO, offset) {
  const date = new Date(`${commencementISO}T00:00:00`);
  date.setMonth(date.getMonth() + offset);
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

// A signed-percentage delta label, with the base run marked, and a plain rate
// label, both matching the on-screen sensitivity grids.
function delta(value) {
  if (value === 0) return 'Base';
  return `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`;
}

function rate(value) {
  return `${Math.round(value * 100)}%`;
}

// ── Sheets ──────────────────────────────────────────────────────────────────

function summarySheet({ result, meta, generatedDate, schemeName }) {
  const { returns, decision, waterfall, sourcesAndUses, funding } = result;
  const inputs = meta.inputs;
  const currency = meta.currency;
  const isJv = meta.strategy === FUNDING_STRATEGY.JOINT_VENTURE;

  const seniorFacility = funding.totals.seniorFacilityLimit;
  const totalCost = funding.totals.totalProjectCost;

  const rows = [
    [bold('Flitrr STACK')],
    ['Development appraisal and funding report'],
    [`${meta.strategy} scheme, generated ${generatedDate}`],
  ];
  if (schemeName) rows.push([`Scheme: ${schemeName}`]);
  rows.push([`All amounts in ${currency}. Values only: the workbook holds the computed figures, not the model.`]);
  rows.push([]);

  rows.push([bold('Decision'), decision.decision]);
  rows.push(['Project profit', money(returns.projectProfit)]);
  rows.push(['Profit on cost', percent(returns.profitOnCost)]);
  rows.push([result.verdict]);
  rows.push([]);

  rows.push([bold('Return metrics')]);
  rows.push([bold('View'), bold('IRR'), bold('Multiple'), bold('Profit')]);
  rows.push(['Project (unlevered)', percent(returns.project.irr), multiple(returns.project.multiple), money(returns.project.profit)]);
  rows.push(['Equity (levered)', percent(returns.equity.irr), multiple(returns.equity.multiple), money(returns.equity.profit)]);
  rows.push(['After tax (equity)', percent(returns.afterTax.irr), multiple(returns.afterTax.multiple), money(returns.afterTax.profit)]);
  rows.push([]);

  if (isJv) {
    const parties = [
      ['Sponsor', waterfall.parties.sponsor, returns.perParty.sponsorIrr],
      ['Funding partner', waterfall.parties.partner, returns.perParty.partnerIrr],
      ['Landowner', waterfall.parties.landowner, returns.perParty.landownerIrr],
    ];
    rows.push([bold('Partnership')]);
    rows.push([bold('Party'), bold('Capital in'), bold('Cash out'), bold('Profit'), bold('Multiple'), bold('IRR')]);
    for (const [label, party, irr] of parties) {
      rows.push([label, money(party.capital), money(party.cash), money(party.profit), multiple(party.multiple), percent(irr)]);
    }
    rows.push([]);
  }

  rows.push([bold('Uses')]);
  for (const [key, label] of Object.entries(USES_LABELS)) {
    if (sourcesAndUses.uses[key] > 0) rows.push([label, money(sourcesAndUses.uses[key])]);
  }
  rows.push(['Total uses', moneyBold(sourcesAndUses.uses.total)]);
  rows.push([]);

  rows.push([bold('Sources')]);
  for (const [key, label] of Object.entries(SOURCES_LABELS)) {
    if (sourcesAndUses.sources[key] > 0) rows.push([label, money(sourcesAndUses.sources[key])]);
  }
  rows.push(['Total sources', moneyBold(sourcesAndUses.sources.total)]);
  rows.push([]);

  rows.push([bold('Credit and margin')]);
  if (seniorFacility > 0) {
    rows.push(['Senior loan to cost', percent(seniorFacility / totalCost)]);
    rows.push(['Senior loan to GDV', percent(seniorFacility / inputs.gdv)]);
    rows.push(['Peak senior exposure', money(funding.peakSeniorDebt)]);
  }
  rows.push(['Finance cost', money(funding.totalFinanceCost)]);
  rows.push(['Profit on GDV', percent(returns.profitOnGdv)]);
  rows.push(['Residual land value', money(returns.residualLandValue)]);
  rows.push(['Headroom vs current land', money(returns.residualLandValue - inputs.landValue)]);
  rows.push(['GDV can fall to break even', percent(returns.breakEven.gdvFallToBreakEven)]);
  rows.push(['Cost can overrun to break even', percent(returns.breakEven.costOverrunToBreakEven)]);

  return { name: 'Summary', columnWidths: [34, 15, 13, 15, 13, 12], rows };
}

function cashflowSheet({ result, meta }) {
  const { rows: months, peakFunding } = result.cashflow;
  const currency = meta.currency;

  const rows = [
    [bold('Cashflow')],
    [`Costs by phase and the sale across the calendar, in ${currency}. The cumulative position is the funding requirement, ending at the project profit.`],
    ['Peak funding requirement', money(peakFunding)],
    [],
    [
      bold('Month'),
      bold('Calendar'),
      bold('Acquisition'),
      bold('Design and pre-construction'),
      bold('Construction'),
      bold('Finance'),
      bold('Sales'),
      bold('Net movement'),
      bold('Cumulative position'),
    ],
  ];

  months.forEach((row, idx) => {
    rows.push([
      row.month,
      monthLabel(meta.commencementDate, idx),
      money(row.acquisition),
      money(row.design),
      money(row.construction),
      money(row.finance),
      money(row.sales),
      money(row.netMovement),
      money(row.cumulative),
    ]);
  });

  return { name: 'Cashflow', columnWidths: [8, 10, 13, 26, 13, 13, 13, 14, 18], rows };
}

function comparisonSheet({ result }) {
  const c = result.comparison;
  const routes = [
    ['Self-funded', c.selfFunded, 'Most cash in, no debt'],
    ['Bank-financed', c.bankFinanced, 'Senior debt, less cash in'],
    ['Mixed', c.mixed, 'Senior plus mezzanine'],
    [`${c.selected.strategy} (selected)`, c.selected, 'Your route, live'],
    ['Off-plan', c.offPlan, 'Pre-sales fund the build'],
  ];

  const rows = [
    [bold('The same scheme, funded five ways')],
    ['Cash in and profit are your slice. Your selected route is live from the engine; the others are like-for-like estimates.'],
    [],
    [bold('Route'), bold('Note'), bold('Cash in'), bold('Profit'), bold('Return on cash'), bold('Profit on cost')],
  ];
  for (const [label, route, note] of routes) {
    rows.push([label, note, money(route.cashIn), money(route.profit), multiple(route.returnOnCash), percent(route.profitOnCost)]);
  }

  return { name: 'Comparison', columnWidths: [26, 28, 14, 14, 15, 14], rows };
}

function sensitivitySheet({ result, meta }) {
  const { viability, jvTerms } = result.sensitivity;
  const isJv = meta.strategy === FUNDING_STRATEGY.JOINT_VENTURE;

  const rows = [
    [bold('Scheme viability')],
    ['Profit on cost as GDV (across) and build cost (down) move.'],
    [bold('Build \\ GDV'), ...viability.gdvDeltas.map((d) => bold(delta(d)))],
  ];
  viability.buildDeltas.forEach((d, i) => {
    rows.push([bold(delta(d)), ...viability.grid[i].map(percent)]);
  });

  if (isJv) {
    rows.push([]);
    rows.push([bold('Joint venture deal terms')]);
    rows.push(['Sponsor return multiple as the preferred return (down) and the promote (across) move.']);
    rows.push([bold('Pref \\ Promote'), ...jvTerms.promoteShares.map((s) => bold(rate(s)))]);
    jvTerms.prefRates.forEach((r, i) => {
      rows.push([bold(rate(r)), ...jvTerms.grid[i].map(multiple)]);
    });
  }

  return { name: 'Sensitivity', columnWidths: [16, 10, 10, 10, 10, 10, 10, 10], rows };
}

// The value cell for an input field, by the form model's field kind.
function inputCell(kind, value) {
  if (isBlank(value) || value === '') return 'n/a';
  switch (kind) {
    case 'money':
      return money(value);
    case 'percent':
      return percent(value);
    case 'multiple':
      return multiple(value);
    case 'months':
    case 'count':
      return number(value);
    default:
      return String(value);
  }
}

function inputsSheet({ meta }) {
  const inputs = meta.inputs;
  const rows = [
    [bold('Inputs')],
    ['The complete input set this appraisal was computed from.'],
  ];

  // The form model's sections and visibility rules decide which inputs are in
  // play for the chosen strategy; the predicates read only the enum choices,
  // which the engine input set holds in the same vocabulary as the form.
  for (const section of SECTIONS) {
    if (section.show && !section.show(inputs)) continue;
    const fields = section.fields.filter((f) => !f.show || f.show(inputs));
    if (fields.length === 0) continue;
    rows.push([]);
    rows.push([bold(section.title)]);
    for (const field of fields) {
      rows.push([field.label, inputCell(field.kind, inputs[field.key])]);
    }
  }

  return { name: 'Inputs', columnWidths: [34, 18], rows };
}

function notesSheet({ result, generatedDate, engineVersion, schemeName }) {
  const rows = [
    [bold('Notes')],
    [`Generated by Flitrr STACK on ${generatedDate}.`],
    [`Engine version ${engineVersion}.`],
  ];
  if (schemeName) rows.push([`Scheme: ${schemeName}`]);
  rows.push(['Values only. The workbook holds the computed figures; the model itself stays on the platform and is not included.']);
  rows.push(['This workbook is licensed for this appraisal only and is not to be reused as a live model. Illustrative figures for design purposes, not investment, financial or valuation advice.']);
  rows.push([]);
  rows.push([bold('Reconciliation')]);
  rows.push(['Three invariants the model must reconcile to zero.']);
  rows.push(['Cash uses reconciliation', number(result.invariants.cashUsesReconciliation)]);
  rows.push(['Waterfall reconciliation', number(result.invariants.waterfallReconciliation)]);
  rows.push(['Sources less uses', number(result.invariants.sourcesLessUses)]);

  return { name: 'Notes', columnWidths: [34, 14], rows };
}

// ── The public entry point ──────────────────────────────────────────────────

/**
 * Build the values-only workbook definition for an appraisal.
 *
 * @param {{ result: object, meta: object, generatedDate: string, engineVersion: string, schemeName?: string|null }} report
 * @returns {{ moneyFormat: string, sheets: object[] }} the writer's input
 */
export function buildWorkbook({ result, meta, generatedDate, engineVersion, schemeName = null }) {
  const symbol = resolveCurrencySymbol(meta.currency);
  const report = { result, meta, generatedDate, engineVersion, schemeName };

  return {
    moneyFormat: `"${symbol}"#,##0`,
    sheets: [
      summarySheet(report),
      cashflowSheet(report),
      comparisonSheet(report),
      sensitivitySheet(report),
      inputsSheet(report),
      notesSheet(report),
    ],
  };
}
