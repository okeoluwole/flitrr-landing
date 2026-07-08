'use server';

/**
 * STACK server actions. The engine runs here, on the server, and is never
 * imported by a client component, so the deterministic modelling logic is never
 * shipped to the browser. The client sends the raw form values; this action
 * coerces and merges them onto the base case, runs the appraisal, and returns
 * the plain, serialisable result.
 */

import { computeAppraisal, baseCaseInputs } from '../../lib/stack/engine/index.js';

// The input fields that are numbers. Everything else is an enum string or a
// date string. Optional per-unit metrics stay null unless a value is given.
const NUMERIC_FIELDS = new Set([
  'gdv',
  'salesCostsRate',
  'constructionCost',
  'professionalFees',
  'statutory',
  'acquisitionLegal',
  'landValue',
  'sdlt',
  'programmeMonths',
  'constructionStartMonth',
  'constructionEndMonth',
  'completionSaleMonth',
  'devManagementFeeRate',
  'seniorLtcCap',
  'seniorLtgdvCap',
  'seniorInterestRate',
  'seniorArrangementFee',
  'seniorExitFee',
  'preferredReturnRate',
  'cashEquityPartnerSplit',
  'residualProfitToCapital',
  'targetProfitOnCost',
  'mezzanineInterestRate',
  'mezzanineCombinedLtc',
  'equityMultipleHurdle',
  'presaleProportionNdv',
  'corporationTaxRate',
  'carriedInterest',
  'constructionContingency',
  'holdingCostPerMonth',
  'buildCostInflation',
  'salesValueGrowth',
  'considerBand',
  'netSaleableArea',
  'numberOfUnits',
]);

/**
 * Coerce a raw input map onto a complete, typed input set. Missing or blank
 * fields fall back to the base case, so a partial input still computes.
 *
 * @param {object} raw the raw form values, strings or numbers
 * @returns {object} a complete engine input set
 */
function normaliseInputs(raw) {
  const inputs = baseCaseInputs();
  if (!raw) return inputs;

  for (const [key, value] of Object.entries(raw)) {
    if (!(key in inputs)) continue;
    if (value === undefined || value === null || value === '') continue;
    inputs[key] = NUMERIC_FIELDS.has(key) ? Number(value) : value;
  }
  return inputs;
}

/**
 * Run the development appraisal for a raw input map.
 *
 * @param {object} raw the raw form values
 * @returns {Promise<{ ok: boolean, result?: object, error?: string }>}
 */
export async function runAppraisal(raw) {
  try {
    const inputs = normaliseInputs(raw);
    const result = computeAppraisal(inputs);
    // The result holds no inputs, so hand back the display essentials the read
    // only views need: the reporting currency and the commencement date.
    const meta = {
      currency: inputs.reportingCurrency,
      commencementDate: inputs.commencementDate,
      strategy: inputs.fundingStrategy,
    };
    return { ok: true, result, meta };
  } catch (err) {
    return { ok: false, error: 'The appraisal could not be computed from these inputs.' };
  }
}
