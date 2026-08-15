/**
 * STACK funding engine, the five-route comparison (Bucket 1, sub-step 1.8).
 * The workbook's Comparison tab and the Summary "funding routes compared" block.
 *
 * The same scheme funded five ways, so the developer sees the funding decision
 * on evidence. Four routes are like-for-like closed-form estimates (self-funded,
 * bank-financed, mixed senior plus mezzanine, and off-plan); the fifth is the
 * route the developer has actually selected, linked to the live engine and the
 * waterfall, so it shows their exact slice rather than an estimate.
 *
 * Each route reports the developer's cash in, the developer's profit (their
 * slice, which for the joint venture is after the partner and landowner shares),
 * the return on that cash, and the project's profit on cost. This is the proof
 * that a funding approach is a configuration of one structure, not a separate
 * model.
 */

// The comparison's transparent, closed-form assumptions (Comparison C5 to C11).
// These are estimation parameters for the non-selected routes, not scheme inputs.
const COMPARISON_ASSUMPTIONS = {
  averageDrawnBalanceFactor: 0.55, // C5, of facility over the active period
  mixedCombinedLtc: 0.8, // C7, senior plus mezzanine loan to cost
  mixedMezzanineRate: 0.12, // C8
  offplanUnitsPresold: 0.5, // C9, of GDV
  offplanPresaleCashPct: 0.5, // C10, of pre-sold value received during build
  offplanBridgeRate: 0.1, // C11
};

/**
 * Build the five-route comparison.
 *
 * @param {object} inputs a full input set
 * @param {object} funding the funding summary from `fundingSummary`
 * @param {object} waterfall the waterfall from `distributionWaterfall`
 * @param {object} returns the return metrics from `returnsAndMetrics`
 * @returns {{
 *   selfFunded: object,
 *   bankFinanced: object,
 *   mixed: object,
 *   offPlan: object,
 *   selected: object,
 * }} each route with cashIn, profit, returnOnCash and profitOnCost
 */
export function fundingComparison(inputs, funding, waterfall, returns) {
  const a = COMPARISON_ASSUMPTIONS;
  const { ndv } = funding;
  const { cashDevCost } = funding.totals;
  const activePeriodYears = inputs.completionSaleMonth / 12; // C6

  // The closed-form cost base treats land as bought, and excludes the
  // development management fee (Comparison C20).
  const devCost = cashDevCost + inputs.landValue + inputs.sdlt;

  // The senior estimate the bank and mixed routes share (Comparison D15 / E15).
  const seniorEstimate = Math.min(
    inputs.seniorLtcCap * devCost,
    inputs.seniorLtgdvCap * inputs.gdv,
  );

  // Closed-form senior finance: an average-balance interest estimate plus the
  // arrangement and exit fees.
  const seniorFinance = (senior) =>
    senior *
    (inputs.seniorInterestRate * a.averageDrawnBalanceFactor * activePeriodYears +
      inputs.seniorArrangementFee +
      inputs.seniorExitFee);

  // Assemble a route from its cost, finance and the developer's cash in.
  const closedFormRoute = (finance, cashIn) => {
    const totalCost = devCost + finance;
    const profit = ndv - totalCost;
    return {
      cashIn,
      profit,
      profitOnCost: profit / totalCost,
      returnOnCash: cashIn === 0 ? null : (cashIn + profit) / cashIn,
    };
  };

  // Self-funded (Comparison C): all equity, no finance.
  const selfFunded = closedFormRoute(0, devCost);

  // Bank-financed (Comparison D): senior only.
  const bankFinance = seniorFinance(seniorEstimate);
  const bankFinanced = closedFormRoute(bankFinance, devCost + bankFinance - seniorEstimate);

  // Mixed (Comparison E): senior plus a mezzanine top-up to the combined LTC.
  const mezzanine = Math.max(0, a.mixedCombinedLtc * devCost - seniorEstimate);
  const mixedFinance =
    seniorFinance(seniorEstimate) +
    mezzanine * a.mixedMezzanineRate * a.averageDrawnBalanceFactor * activePeriodYears;
  const mixed = closedFormRoute(
    mixedFinance,
    devCost + mixedFinance - seniorEstimate - mezzanine,
  );

  // Off-plan (Comparison G): a front-end bridge, pre-sales fund the build.
  const bridge = Math.max(
    0,
    inputs.acquisitionLegal + 0.3 * inputs.professionalFees + inputs.landValue + inputs.sdlt,
  );
  const presaleCash = a.offplanUnitsPresold * ndv * a.offplanPresaleCashPct;
  const offplanFinance =
    bridge *
    a.offplanBridgeRate *
    0.6 *
    ((inputs.constructionEndMonth - inputs.constructionStartMonth + 1) / 12);
  const offPlan = closedFormRoute(
    offplanFinance,
    Math.max(0, devCost + offplanFinance - bridge - presaleCash),
  );

  // The selected route (Comparison F), linked to the live engine and waterfall.
  // The developer's slice: their cash in, and their cash out through the
  // waterfall, which for the joint venture is net of the partner and landowner.
  const sponsorCashIn = funding.sponsorCashEquity;
  const sponsorCashOut = waterfall.parties.sponsor.cash;
  const selected = {
    strategy: inputs.fundingStrategy,
    cashIn: sponsorCashIn,
    profit: sponsorCashOut - sponsorCashIn,
    profitOnCost: returns.profitOnCost,
    returnOnCash: sponsorCashIn === 0 ? null : sponsorCashOut / sponsorCashIn,
  };

  return { selfFunded, bankFinanced, mixed, offPlan, selected };
}
