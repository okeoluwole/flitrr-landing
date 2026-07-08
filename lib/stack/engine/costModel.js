/**
 * STACK funding engine, the cost model (Bucket 1, sub-step 1.2).
 *
 * Turns the scheme inputs into the cost totals the rest of the engine sizes
 * against, and into the monthly cash-use vector that drives the senior debt
 * schedule and the cashflow. This is the workbook's derived-sizing block
 * (Inputs C50 to C54, C97, C25) and the Engine tab's "Cost outflow" row (row 5).
 *
 * The one subtlety worth stating: contributed land is a real cost of the project
 * (it sits in the total project cost at its valuation), but it is not a cash use,
 * so it never appears in the monthly cash-use vector. It enters the model as
 * equity, in the waterfall. Land only lands in the cash-use vector when it is
 * bought for cash, and then only in month 1, together with its SDLT.
 *
 * Pure functions, no side effects. Money is in the reporting currency.
 */

import { BUILD_DRAWDOWN_PROFILE } from './inputs.js';

/**
 * Net development value (Inputs C25). The grown GDV, net of sales costs. Growth
 * compounds from today to the sale month; with zero growth it is simply GDV less
 * sales costs.
 *
 * @param {object} inputs a full input set
 * @returns {number} the NDV, what the project receives on sale
 */
export function netDevelopmentValue(inputs) {
  const { gdv, salesValueGrowth, completionSaleMonth, salesCostsRate } = inputs;
  return (
    gdv * Math.pow(1 + salesValueGrowth, completionSaleMonth / 12) * (1 - salesCostsRate)
  );
}

/**
 * Effective build cost (Inputs C97). The base construction cost lifted for
 * contingency and escalated for inflation to the construction midpoint. With
 * both at zero it equals the base construction cost.
 *
 * @param {object} inputs a full input set
 * @returns {number} the effective build cost
 */
export function effectiveBuildCost(inputs) {
  const {
    constructionCost,
    constructionContingency,
    buildCostInflation,
    constructionStartMonth,
    constructionEndMonth,
  } = inputs;
  const midpointYears = (constructionStartMonth + constructionEndMonth) / 2 / 12;
  return (
    constructionCost *
    (1 + constructionContingency) *
    Math.pow(1 + buildCostInflation, midpointYears)
  );
}

/**
 * The cost totals the engine sizes against (Inputs C50 to C54).
 *
 *   devManagementFee    C50 = fee rate x GDV, paid to the sponsor.
 *   cashDevCost         C51 = effective build + fees + statutory + acquisition.
 *   totalCashUses       C52 = cash dev cost + fee + (land + SDLT if purchased).
 *   totalProjectCost    C53 = total cash uses + land at valuation if contributed.
 *   seniorFacilityLimit C54 = lower of the LTC and LTGDV caps, or zero when the
 *                             route uses no senior debt.
 *
 * @param {object} inputs a full input set
 * @param {object} switches the derived switches from `deriveSwitches`
 * @returns {{
 *   effectiveBuild: number,
 *   devManagementFee: number,
 *   cashDevCost: number,
 *   totalCashUses: number,
 *   totalProjectCost: number,
 *   seniorFacilityLimit: number,
 * }}
 */
export function costTotals(inputs, switches) {
  const {
    gdv,
    devManagementFeeRate,
    professionalFees,
    statutory,
    acquisitionLegal,
    landValue,
    sdlt,
    seniorLtcCap,
    seniorLtgdvCap,
  } = inputs;

  const effectiveBuild = effectiveBuildCost(inputs);
  const devManagementFee = devManagementFeeRate * gdv; // C50
  const cashDevCost = effectiveBuild + professionalFees + statutory + acquisitionLegal; // C51

  // Land and SDLT are a cash use only when the land is bought for cash (C18).
  const landCashCost = switches.landCashPurchase ? landValue + sdlt : 0;
  const totalCashUses = cashDevCost + devManagementFee + landCashCost; // C52

  // Contributed land is a cost at valuation but not a cash use (C17).
  const landContributedCost = switches.landContributedEquity ? landValue : 0;
  const totalProjectCost = totalCashUses + landContributedCost; // C53

  // The lower of the two senior caps binds; zero when the route uses no senior.
  const seniorFacilityLimit = switches.useSeniorDebt
    ? Math.min(seniorLtcCap * totalProjectCost, seniorLtgdvCap * gdv)
    : 0; // C54

  return {
    effectiveBuild,
    devManagementFee,
    cashDevCost,
    totalCashUses,
    totalProjectCost,
    seniorFacilityLimit,
  };
}

/**
 * The share of the construction pool spent in one construction month (Engine
 * row 5, the profile switch). Even spreads it equally; S-curve back-loads then
 * tapers using a smoothstep, so a slow start and a mid peak, with the same total.
 *
 * The smoothstep is the difference of the cumulative curve at this month and the
 * previous month, so the weights sum to one across the construction window.
 *
 * @param {number} month 1-based calendar month index
 * @param {object} inputs a full input set
 * @returns {number} the month's share of the construction pool (0 outside build)
 */
export function constructionWeight(month, inputs) {
  const { constructionStartMonth: start, constructionEndMonth: end, buildDrawdownProfile } = inputs;
  if (month < start || month > end) return 0;
  const span = end - start + 1;
  if (buildDrawdownProfile === BUILD_DRAWDOWN_PROFILE.S_CURVE) {
    const smooth = (x) => 3 * x * x - 2 * x * x * x;
    const upper = (month - start + 1) / span;
    const lower = (month - start) / span;
    return smooth(upper) - smooth(lower);
  }
  return 1 / span;
}

/**
 * The monthly cash-use vector (Engine row 5). One entry per programme month.
 * Each month carries, as applicable:
 *   - pre-construction: acquisition and legal plus 30% of fees, spread evenly
 *     over the months before construction starts;
 *   - construction: the build pool (effective build + 70% of fees + statutory +
 *     development management fee), shaped by the drawdown profile;
 *   - month 1 only, and only when the land is a cash purchase: land plus SDLT.
 *
 * Contributed land is deliberately absent, it is equity, not a cash use.
 *
 * @param {object} inputs a full input set
 * @param {object} switches the derived switches from `deriveSwitches`
 * @returns {number[]} length equals the programme in months
 */
export function costOutflowVector(inputs, switches) {
  const {
    programmeMonths,
    constructionStartMonth: start,
    constructionEndMonth: end,
    professionalFees,
    statutory,
    acquisitionLegal,
    landValue,
    sdlt,
  } = inputs;

  const effectiveBuild = effectiveBuildCost(inputs);
  const devManagementFee = inputs.devManagementFeeRate * inputs.gdv;

  const preMonths = start - 1;
  const preConstructionPerMonth =
    preMonths > 0 ? (acquisitionLegal + 0.3 * professionalFees) / preMonths : 0;
  const constructionPool = effectiveBuild + 0.7 * professionalFees + statutory + devManagementFee;
  const landInMonthOne = switches.landCashPurchase ? landValue + sdlt : 0;

  const vector = [];
  for (let month = 1; month <= programmeMonths; month += 1) {
    let use = 0;
    if (month <= preMonths) use += preConstructionPerMonth;
    if (month >= start && month <= end) use += constructionPool * constructionWeight(month, inputs);
    if (month === 1) use += landInMonthOne;
    vector.push(use);
  }
  return vector;
}
