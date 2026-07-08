/**
 * The STACK form model (sub-step 2.2). A data-driven description of the input
 * form: the sections, the fields, their guidance and examples, the option lists,
 * and the rules for which fields show under which funding strategy. The form
 * component renders from this, so the guidance and the branching live in one
 * place and stay close to the engine's Inputs contract.
 *
 * This is client-safe: it imports only the option constants from the engine's
 * input contract, never the calculation modules. Percentages are shown to the
 * developer as whole numbers (2 for 2 per cent); the form converts to and from
 * the fractions the engine expects.
 */

import {
  FUNDING_STRATEGY,
  DEBT_STRUCTURE,
  JV_PARTNER_CONTRIBUTES,
  PROMOTE_HURDLE_BASIS,
  INTEREST_BASIS,
  BUILD_DRAWDOWN_PROFILE,
  FUNDING_SEQUENCE,
  YES,
  NO,
} from '../../lib/stack/engine/inputs.js';

const yesNo = [
  { value: YES, label: 'Yes' },
  { value: NO, label: 'No' },
];

// Predicates for the strategy branches, reused across field visibility rules.
const isDebt = (v) => v.fundingStrategy === FUNDING_STRATEGY.DEBT_FINANCED;
const isJv = (v) => v.fundingStrategy === FUNDING_STRATEGY.JOINT_VENTURE;
const usesMezzanine = (v) => isDebt(v) && v.debtStructure === DEBT_STRUCTURE.SENIOR_PLUS_MEZZ;
const usesSenior = (v) =>
  v.fundingStrategy !== FUNDING_STRATEGY.SELF_FUNDED &&
  !(isJv(v) && v.seniorAlongsideJv === NO);

/**
 * The mezzanine guard, per the product decision: the model does not reconcile a
 * mezzanine sized on contributed land or heavy pre-sales, so the form does not
 * offer own-land or pre-sales on the mezzanine branch.
 */
export function mezzanineGuardActive(values) {
  return usesMezzanine(values);
}

// Field kinds drive formatting and conversion:
//   money   plain amount in the reporting currency
//   percent shown as a whole number, stored as a fraction
//   multiple a bare multiple (1.3), stored as-is
//   months  a whole number of months
//   count   a whole number
//   date    an ISO date string
//   select  an enum, forced choice
export const SECTIONS = [
  {
    id: 'funding',
    title: 'How is it funded?',
    blurb: 'The funding strategy is the main switch. It drives everything else.',
    fields: [
      {
        key: 'fundingStrategy',
        label: 'Funding strategy',
        kind: 'select',
        options: Object.values(FUNDING_STRATEGY).map((v) => ({ value: v, label: v })),
        guide: 'Self-funded, debt-financed, a joint venture, or off-plan pre-sales.',
      },
      {
        key: 'debtStructure',
        label: 'Debt structure',
        kind: 'select',
        options: Object.values(DEBT_STRUCTURE).map((v) => ({ value: v, label: v })),
        guide: 'Senior loan alone, or senior plus a mezzanine top-up.',
        show: isDebt,
      },
      {
        key: 'jvPartnerContributes',
        label: 'The partner brings',
        kind: 'select',
        options: Object.values(JV_PARTNER_CONTRIBUTES).map((v) => ({ value: v, label: v })),
        guide: 'What the JV partner contributes: cash, land, or both.',
        show: isJv,
      },
      {
        key: 'seniorAlongsideJv',
        label: 'Senior debt alongside the JV?',
        kind: 'select',
        options: yesNo,
        guide: 'Whether senior debt sits alongside the partner equity.',
        show: isJv,
      },
      {
        key: 'ownLand',
        label: 'Do you already own the land?',
        kind: 'select',
        options: yesNo,
        guide: 'Yes contributes the land as equity at its value. No buys it for cash, with SDLT.',
        // Hidden on the mezzanine branch: contributed land is not modelled there.
        show: (v) => !mezzanineGuardActive(v),
      },
    ],
  },
  {
    id: 'scheme',
    title: 'The scheme',
    blurb: 'The value it will sell for, and what it costs to build.',
    fields: [
      { key: 'gdv', label: 'Gross development value (GDV)', kind: 'money', guide: 'The sale value of the finished scheme.' },
      { key: 'salesCostsRate', label: 'Sales costs', kind: 'percent', guide: 'Agent and legal, as a share of GDV. Typical 1 to 2%.' },
      { key: 'constructionCost', label: 'Construction cost', kind: 'money', guide: 'The build cost, all elements.' },
      { key: 'professionalFees', label: 'Professional fees', kind: 'money', guide: 'The design and consultant team.' },
      { key: 'statutory', label: 'Statutory (S106 / CIL)', kind: 'money', guide: 'Planning obligations and levies.' },
      { key: 'acquisitionLegal', label: 'Acquisition and legal', kind: 'money', guide: 'Deal and legal costs at the front.' },
      { key: 'landValue', label: 'Land value (agreed)', kind: 'money', guide: 'The agreed worth of the land.' },
      {
        key: 'sdlt',
        label: 'SDLT (if buying the land)',
        kind: 'money',
        guide: 'Stamp duty on a cash land purchase.',
        show: (v) => v.ownLand === NO && !isJv(v),
      },
    ],
  },
  {
    id: 'programme',
    title: 'Programme',
    blurb: 'When the project starts, builds, and sells.',
    fields: [
      { key: 'commencementDate', label: 'Commencement date', kind: 'date', guide: 'Month 1 of the cashflow.' },
      { key: 'programmeMonths', label: 'Programme length', kind: 'months', guide: 'Total project length, in months.' },
      { key: 'constructionStartMonth', label: 'Construction starts (month)', kind: 'months', guide: 'When build draws begin.' },
      { key: 'constructionEndMonth', label: 'Construction ends (month)', kind: 'months', guide: 'When build draws finish.' },
      { key: 'completionSaleMonth', label: 'Completion and sale (month)', kind: 'months', guide: 'When the net sale value is received.' },
    ],
  },
  {
    id: 'terms',
    title: 'Funding terms',
    blurb: 'The fees, the debt limits, and your target.',
    fields: [
      { key: 'devManagementFeeRate', label: 'Development management fee', kind: 'percent', guide: 'Of GDV, paid to the sponsor. Typical 1.5 to 3%.' },
      { key: 'targetProfitOnCost', label: 'Target profit on cost', kind: 'percent', guide: 'Your go / no-go hurdle. SME hurdle 15 to 20%.' },
      { key: 'seniorLtcCap', label: 'Senior loan to cost cap', kind: 'percent', guide: 'Regional LTC 50 to 70%.', show: usesSenior },
      { key: 'seniorLtgdvCap', label: 'Senior loan to GDV cap', kind: 'percent', guide: 'Regional LTGDV cap.', show: usesSenior },
      { key: 'seniorInterestRate', label: 'Senior interest rate', kind: 'percent', guide: 'Per year, rolled up. Typical 6.5 to 9%.', show: usesSenior },
      { key: 'seniorArrangementFee', label: 'Senior arrangement fee', kind: 'percent', guide: 'Of the facility. Typical 1 to 2%.', show: usesSenior },
      { key: 'seniorExitFee', label: 'Senior exit fee', kind: 'percent', guide: 'On redemption. Typical 1 to 2%.', show: usesSenior },
      { key: 'mezzanineCombinedLtc', label: 'Combined loan to cost (mezz)', kind: 'percent', guide: 'Senior plus mezzanine gearing. Typical 70 to 80%.', show: usesMezzanine },
      { key: 'mezzanineInterestRate', label: 'Mezzanine interest rate', kind: 'percent', guide: 'Per year. Typical 10 to 14%.', show: usesMezzanine },
    ],
  },
  {
    id: 'jv',
    title: 'Joint venture terms',
    blurb: 'How the profit is shared with the partner.',
    show: isJv,
    fields: [
      { key: 'preferredReturnRate', label: 'Preferred return', kind: 'percent', guide: 'Per year, the JV hurdle before the promote.' },
      { key: 'cashEquityPartnerSplit', label: 'Partner share of cash equity', kind: 'percent', guide: 'The partner funds this share; the sponsor funds the rest.' },
      { key: 'residualProfitToCapital', label: 'Residual profit to capital', kind: 'percent', guide: 'The pro-rata share of the residual; the remainder is the promote.' },
      {
        key: 'promoteHurdleBasis',
        label: 'Promote hurdle basis',
        kind: 'select',
        options: Object.values(PROMOTE_HURDLE_BASIS).map((v) => ({ value: v, label: v })),
        guide: 'Whether the hurdle is the preferred return or an equity multiple.',
      },
      {
        key: 'equityMultipleHurdle',
        label: 'Equity multiple hurdle',
        kind: 'multiple',
        guide: 'Partners must reach this multiple before the promote applies.',
        show: (v) => isJv(v) && v.promoteHurdleBasis === PROMOTE_HURDLE_BASIS.EQUITY_MULTIPLE,
      },
      { key: 'useGpCatchupCarry', label: 'Use GP catch-up and carry', kind: 'select', options: yesNo, guide: 'Replace the simple split with an institutional pref, catch-up, then carry.' },
      {
        key: 'carriedInterest',
        label: 'Carried interest (GP carry)',
        kind: 'percent',
        guide: 'The GP share of profit above the preferred return.',
        show: (v) => isJv(v) && v.useGpCatchupCarry === YES,
      },
    ],
  },
  {
    id: 'advanced',
    title: 'More options',
    blurb: 'Refinements. The defaults leave the base case unchanged.',
    advanced: true,
    fields: [
      {
        key: 'modelPresales',
        label: 'Model off-plan pre-sales',
        kind: 'select',
        options: yesNo,
        guide: 'Fund construction with pre-sale receipts, cutting rolled-up interest.',
        show: (v) => !mezzanineGuardActive(v),
      },
      {
        key: 'presaleProportionNdv',
        label: 'Pre-sale share of net sales',
        kind: 'percent',
        guide: 'The share of net sales received in stages across construction.',
        show: (v) => v.modelPresales === YES && !mezzanineGuardActive(v),
      },
      { key: 'constructionContingency', label: 'Construction contingency', kind: 'percent', guide: 'Buffer on the build cost. Best practice 5 to 7.5%.' },
      { key: 'holdingCostPerMonth', label: 'Void holding cost (per month)', kind: 'money', guide: 'Running cost per month on unsold units after construction.' },
      {
        key: 'interestBasis',
        label: 'Interest accrual basis',
        kind: 'select',
        options: Object.values(INTEREST_BASIS).map((v) => ({ value: v, label: v })),
        guide: 'Opening balance is the simple roll-up; average balance is more precise.',
        show: usesSenior,
      },
      {
        key: 'buildDrawdownProfile',
        label: 'Build drawdown profile',
        kind: 'select',
        options: Object.values(BUILD_DRAWDOWN_PROFILE).map((v) => ({ value: v, label: v })),
        guide: 'Even spreads the build equally; S-curve back-loads it.',
      },
      { key: 'buildCostInflation', label: 'Build cost inflation', kind: 'percent', guide: 'Per year, to the construction midpoint.' },
      { key: 'salesValueGrowth', label: 'Sales value growth', kind: 'percent', guide: 'Per year, grows GDV to the sale month.' },
      {
        key: 'fundingSequence',
        label: 'Funding sequence',
        kind: 'select',
        options: Object.values(FUNDING_SEQUENCE).map((v) => ({ value: v, label: v })),
        guide: 'Debt first draws senior then equity; equity first funds the front end.',
        show: usesSenior,
      },
      { key: 'corporationTaxRate', label: 'Corporation tax rate', kind: 'percent', guide: 'On project profit after finance. Drives the after-tax returns.' },
      { key: 'considerBand', label: 'Consider band', kind: 'percent', guide: 'Points below target that still read CONSIDER rather than NO GO.' },
    ],
  },
  {
    id: 'reporting',
    title: 'Reporting',
    advanced: true,
    fields: [
      {
        key: 'reportingCurrency',
        label: 'Reporting currency',
        kind: 'select',
        options: ['GBP', 'USD', 'EUR', 'NGN', 'SAR', 'CNY'].map((c) => ({ value: c, label: c })),
        guide: 'The currency the whole appraisal is shown in.',
      },
    ],
  },
];

// The set of percent-kind field keys, for the value conversion in the form.
export const PERCENT_FIELDS = new Set(
  SECTIONS.flatMap((s) => s.fields).filter((f) => f.kind === 'percent').map((f) => f.key),
);

// Field key to kind, for conversion and input typing.
export const FIELD_KIND = Object.fromEntries(
  SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, f.kind]),
);

const NUMERIC_KINDS = new Set(['money', 'months', 'count', 'multiple']);

/**
 * Convert an engine input set into the display values the form holds. Percentages
 * become whole numbers (0.02 to 2), cleaned of floating-point noise.
 *
 * @param {object} inputs an engine input set
 * @returns {Record<string, string|number>}
 */
export function toDisplayValues(inputs) {
  const out = {};
  for (const [key, kind] of Object.entries(FIELD_KIND)) {
    const value = inputs[key];
    if (value === null || value === undefined) {
      out[key] = '';
    } else if (kind === 'percent') {
      out[key] = Number((value * 100).toFixed(6));
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Convert the form's display values back to an engine input set. Percentages
 * divide back to fractions; blank fields are dropped so the engine falls back to
 * its default.
 *
 * @param {object} values the display values
 * @returns {object} a partial engine input set
 */
export function toEngineInputs(values) {
  const out = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === '' || value === null || value === undefined) continue;
    const kind = FIELD_KIND[key];
    if (kind === 'percent') out[key] = Number(value) / 100;
    else if (NUMERIC_KINDS.has(kind)) out[key] = Number(value);
    else out[key] = value;
  }
  return out;
}

/**
 * Apply the mezzanine guard to a value set before it goes to the engine: on the
 * mezzanine branch, force off the combinations the model does not reconcile.
 *
 * @param {object} values the current form values
 * @returns {object} a guarded copy
 */
export function applyGuards(values) {
  if (!mezzanineGuardActive(values)) return values;
  return { ...values, ownLand: NO, modelPresales: NO };
}

const MONEY_KEYS = new Set(
  SECTIONS.flatMap((s) => s.fields).filter((f) => f.kind === 'money').map((f) => f.key),
);

/**
 * Validate a value set. Returns a map of field key to message for the fields
 * that fail, empty when the scheme is valid. Amounts and rates must be
 * non-negative, and the programme months must run in order, with construction
 * starting after month 1 so the pre-construction spend has somewhere to land.
 *
 * @param {object} values the current form values
 * @returns {Record<string,string>}
 */
export function validate(values) {
  const errors = {};
  const num = (k) => Number(values[k]);

  for (const key of MONEY_KEYS) {
    if (values[key] !== '' && num(key) < 0) errors[key] = 'Cannot be negative.';
  }
  for (const key of PERCENT_FIELDS) {
    if (values[key] !== '' && num(key) < 0) errors[key] = 'Cannot be negative.';
  }
  if (num('gdv') <= 0) errors.gdv = 'Enter the sale value of the scheme.';

  const start = num('constructionStartMonth');
  const end = num('constructionEndMonth');
  const sale = num('completionSaleMonth');
  const total = num('programmeMonths');

  if (start < 2) errors.constructionStartMonth = 'Construction starts in month 2 or later.';
  if (end < start) errors.constructionEndMonth = 'Construction ends on or after it starts.';
  if (sale < end) errors.completionSaleMonth = 'The sale is on or after construction ends.';
  if (total < sale) errors.programmeMonths = 'The programme runs to at least the sale month.';

  return errors;
}
