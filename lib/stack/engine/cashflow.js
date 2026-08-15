/**
 * STACK funding engine, the monthly cashflow (Bucket 2 support). Reproduces the
 * workbook's Cashflow tab: the scheme's costs by phase and the sale, spread
 * across the calendar from the commencement date, with the net movement and the
 * cumulative cash position each month. The cumulative position is the funding
 * requirement, and it ends at the project profit.
 *
 * This is additive to the engine and does not touch any existing output. It is
 * pure, and it reuses the cost model's effective build cost and drawdown weight
 * so the phasing matches the rest of the engine exactly.
 */

import { effectiveBuildCost, constructionWeight } from './costModel.js';

/**
 * The month by month cashflow.
 *
 * @param {object} inputs a full input set
 * @param {object} switches the derived switches from `deriveSwitches`
 * @param {object} funding the funding summary from `fundingSummary`
 * @returns {{ rows: object[], peakFunding: number }} one row per programme
 *   month, each with the phase subtotals, the net movement and the cumulative
 *   position, plus the peak funding requirement (the deepest cumulative trough)
 */
export function monthlyCashflow(inputs, switches, funding) {
  const {
    programmeMonths,
    constructionStartMonth: start,
    constructionEndMonth: end,
    completionSaleMonth: sale,
    landValue,
    sdlt,
    acquisitionLegal,
    professionalFees,
    statutory,
    holdingCostPerMonth,
  } = inputs;

  const effectiveBuild = effectiveBuildCost(inputs);
  const devManagementFee = inputs.devManagementFeeRate * inputs.gdv;
  const constructionMonths = end - start + 1;
  const preMonths = start - 1;
  const netSaleAtCompletion = funding.ndv - funding.presaleReduction;

  const rows = [];
  let cumulative = 0;

  for (let idx = 0; idx < programmeMonths; idx += 1) {
    const month = idx + 1;
    const inPre = preMonths > 0 && month <= preMonths;
    const inBuild = month >= start && month <= end;

    // Acquisition: land at value in month 1 (always), SDLT on a cash purchase,
    // and the acquisition and legal spread over the pre-construction months.
    let acquisition = 0;
    if (month === 1) acquisition -= landValue;
    if (month === 1 && switches.landCashPurchase) acquisition -= sdlt;
    if (inPre) acquisition -= acquisitionLegal / preMonths;

    // Design and pre-construction: 30% of fees before the build, then 70% of
    // fees and the development management fee across the build.
    let design = 0;
    if (inPre) design -= (0.3 * professionalFees) / preMonths;
    if (inBuild) design -= (0.7 * professionalFees) / constructionMonths + devManagementFee / constructionMonths;

    // Construction: the build, shaped by the drawdown profile, plus statutory.
    let construction = 0;
    if (inBuild) {
      construction -= effectiveBuild * constructionWeight(month, inputs) + statutory / constructionMonths;
    }

    // Finance: rolled-up senior interest each month, the arrangement fee up
    // front, the exit and mezzanine at the sale, and any void holding cost.
    let finance = -funding.schedule.interest[idx];
    if (month === 1) finance -= funding.seniorArrangementFee;
    if (month === sale) finance -= funding.seniorExitFee + funding.mezzanineInterest;
    if (month > end && month <= sale) finance -= holdingCostPerMonth;

    // Sales: pre-sale receipts during the build, the net sale value at completion.
    let sales = funding.presaleVector[idx];
    if (month === sale) sales += netSaleAtCompletion;

    const netMovement = acquisition + design + construction + finance + sales;
    cumulative += netMovement;

    rows.push({ month, acquisition, design, construction, finance, sales, netMovement, cumulative });
  }

  const peakFunding = rows.reduce((low, row) => Math.min(low, row.cumulative), 0);

  return { rows, peakFunding };
}
