/**
 * STACK funding engine, the senior debt schedule and funding stack (Bucket 1,
 * sub-step 1.3). This is the heart of the cash side and the workbook's Engine
 * tab (rows 6 to 31).
 *
 * The rule that makes it deterministic: senior interest accrues on the OPENING
 * balance, so no month depends on its own closing balance and there is no
 * circular reference. Cash uses are funded first by senior debt to its cap, then
 * by cash equity. Pre-sale receipts, when modelled, reduce the sum the senior
 * has to fund. Mezzanine, where used, is a lump top-up that fills part of the
 * equity gap, with its interest rolled up in closed form.
 *
 * Every figure traces to an input and a rule, and the model's reconciliation
 * (cash uses funded equals cash uses) reads zero for every route.
 */

import { INTEREST_BASIS, FUNDING_SEQUENCE, YES } from './inputs.js';
import { netDevelopmentValue, costTotals, costOutflowVector } from './costModel.js';

/**
 * The pre-sale receipts applied each month (Engine row 6). Off by default. When
 * on, a share of the net development value arrives evenly across the build, each
 * month capped at that month's cash use, so a receipt never exceeds the cost it
 * offsets.
 *
 * @param {object} inputs a full input set
 * @param {number[]} costVector the monthly cash-use vector
 * @param {number} ndv the net development value
 * @returns {number[]} monthly pre-sale receipts
 */
export function presaleReceiptVector(inputs, costVector, ndv) {
  const {
    modelPresales,
    constructionStartMonth: start,
    constructionEndMonth: end,
    presaleProportionNdv,
    programmeMonths,
  } = inputs;
  const on = modelPresales === YES;
  const span = end - start + 1;
  const vector = [];
  for (let month = 1; month <= programmeMonths; month += 1) {
    let receipt = 0;
    if (on) {
      const share = month >= start && month <= end ? (presaleProportionNdv * ndv) / span : 0;
      receipt = Math.min(share, costVector[month - 1]);
    }
    vector.push(receipt);
  }
  return vector;
}

/**
 * The month by month senior debt schedule (Engine rows 10 to 13). Interest is on
 * the opening balance (or the average balance when that basis is chosen), and
 * the draw is the lesser of the month's net cash use and the headroom left under
 * the facility after this month's interest. On the equity-first sequence the
 * senior stays undrawn until construction starts.
 *
 * @param {object} inputs a full input set
 * @param {number[]} costVector the monthly cash-use vector
 * @param {number[]} presaleVector the monthly pre-sale receipts
 * @param {number} seniorFacilityLimit the facility cap (Inputs C54)
 * @returns {{
 *   monthlyRate: number,
 *   opening: number[],
 *   interest: number[],
 *   draws: number[],
 *   closing: number[],
 * }}
 */
export function seniorSchedule(inputs, costVector, presaleVector, seniorFacilityLimit) {
  const months = inputs.programmeMonths;
  const monthlyRate = inputs.seniorInterestRate / 12;
  const averageBasis = inputs.interestBasis === INTEREST_BASIS.AVERAGE_BALANCE;
  const equityFirst = inputs.fundingSequence === FUNDING_SEQUENCE.EQUITY_FIRST;
  const start = inputs.constructionStartMonth;

  const opening = new Array(months).fill(0);
  const interest = new Array(months).fill(0);
  const draws = new Array(months).fill(0);
  const closing = new Array(months).fill(0);

  for (let idx = 0; idx < months; idx += 1) {
    const month = idx + 1;
    const open = idx === 0 ? 0 : closing[idx - 1];
    opening[idx] = open;

    const netCost = Math.max(0, costVector[idx] - presaleVector[idx]);
    // Headroom is measured against the opening balance grossed up by this
    // month's interest, so the rolled-up balance never breaches the cap. It uses
    // the opening-balance interest even on the average basis, matching the sheet.
    const headroom = Math.max(0, seniorFacilityLimit - (open + open * monthlyRate));
    const draw = equityFirst && month < start ? 0 : Math.min(netCost, headroom);
    draws[idx] = draw;

    const monthInterest = averageBasis
      ? (open + 0.5 * draw) * monthlyRate
      : open * monthlyRate;
    interest[idx] = monthInterest;

    closing[idx] = open + monthInterest + draw;
  }

  return { monthlyRate, opening, interest, draws, closing };
}

/**
 * The mezzanine facility (Engine B27). A lump top-up sized so senior plus
 * mezzanine reaches the combined loan to cost, above the senior facility. Zero
 * unless the mezzanine branch is active.
 *
 * @param {object} inputs a full input set
 * @param {object} switches the derived switches
 * @param {number} totalProjectCost Inputs C53
 * @param {number} seniorFacilityLimit Inputs C54
 * @returns {number} the mezzanine facility
 */
export function mezzanineFacility(inputs, switches, totalProjectCost, seniorFacilityLimit) {
  if (!switches.useMezzanine) return 0;
  return Math.max(0, inputs.mezzanineCombinedLtc * totalProjectCost - seniorFacilityLimit);
}

/**
 * The full funding and finance picture (Engine funding-outputs block, B14 to
 * B31). Orchestrates the cost model, the pre-sale vector and the senior
 * schedule, then derives the redemption, the finance cost, the cash equity and
 * its sponsor and partner split, the mezzanine roll-up, and the reconciliation.
 *
 * The reconciliation (B26) is the model's own acceptance check: cash equity plus
 * senior draws plus pre-sale receipts plus mezzanine must equal the total cash
 * uses, so it reads zero for every route.
 *
 * @param {object} inputs a full input set
 * @param {object} switches the derived switches from `deriveSwitches`
 * @returns {object} the funding summary, including the cost totals, the NDV, the
 *   monthly vectors, the senior schedule, and every funding output
 */
export function fundingSummary(inputs, switches) {
  const totals = costTotals(inputs, switches);
  const ndv = netDevelopmentValue(inputs);
  const costVector = costOutflowVector(inputs, switches);
  const presaleVector = presaleReceiptVector(inputs, costVector, ndv);
  const schedule = seniorSchedule(inputs, costVector, presaleVector, totals.seniorFacilityLimit);

  const saleIndex = inputs.completionSaleMonth - 1;
  const seniorClosingAtCompletion = schedule.closing[saleIndex]; // B17
  const seniorArrangementFee = totals.seniorFacilityLimit * inputs.seniorArrangementFee; // B18
  const seniorExitFee = seniorClosingAtCompletion * inputs.seniorExitFee; // B19
  const seniorRedemption = seniorClosingAtCompletion + seniorArrangementFee + seniorExitFee; // B20

  const mezzFacility = mezzanineFacility(
    inputs,
    switches,
    totals.totalProjectCost,
    totals.seniorFacilityLimit,
  ); // B27
  const constructionMidpoint =
    (inputs.constructionStartMonth + inputs.constructionEndMonth) / 2;
  const mezzYears = (inputs.completionSaleMonth - constructionMidpoint) / 12;
  const mezzanineInterest =
    mezzFacility * (Math.pow(1 + inputs.mezzanineInterestRate, mezzYears) - 1); // B28
  const mezzanineRedemption = mezzFacility + mezzanineInterest; // B29

  const presaleReduction = presaleVector.reduce((a, b) => a + b, 0); // B30
  const voidHolding =
    inputs.holdingCostPerMonth *
    Math.max(0, inputs.completionSaleMonth - inputs.constructionEndMonth); // B31

  const totalInterest = schedule.interest.reduce((a, b) => a + b, 0);
  const totalFinanceCost =
    totalInterest + seniorArrangementFee + seniorExitFee + mezzanineInterest + voidHolding; // B21
  const peakSeniorDebt = schedule.closing.reduce((a, b) => Math.max(a, b), 0); // B22
  const totalSeniorDrawn = schedule.draws.reduce((a, b) => a + b, 0);

  // Cash equity fills the monthly gap the senior does not cover (Engine row 14).
  const cashEquityDrawVector = costVector.map((cost, idx) =>
    Math.max(0, cost - presaleVector[idx]) - schedule.draws[idx],
  );
  const cashEquityBeforeMezz = cashEquityDrawVector.reduce((a, b) => a + b, 0);
  const totalCashEquity = Math.max(0, cashEquityBeforeMezz - mezzFacility); // B23
  const sponsorCashEquity = totalCashEquity * (1 - switches.partnerCashSplitEffective); // B24
  const partnerCashEquity = totalCashEquity * switches.partnerCashSplitEffective; // B25

  // Reconciliation: funded cash uses equal cash uses (B26). Reads zero.
  const cashUsesReconciliation =
    totalCashEquity + totalSeniorDrawn + presaleReduction + mezzFacility - totals.totalCashUses;

  return {
    totals,
    ndv,
    costVector,
    presaleVector,
    schedule,
    cashEquityDrawVector,
    seniorClosingAtCompletion,
    seniorArrangementFee,
    seniorExitFee,
    seniorRedemption,
    totalInterest,
    totalFinanceCost,
    peakSeniorDebt,
    totalSeniorDrawn,
    mezzanineFacility: mezzFacility,
    mezzanineInterest,
    mezzanineRedemption,
    presaleReduction,
    voidHolding,
    totalCashEquity,
    sponsorCashEquity,
    partnerCashEquity,
    cashUsesReconciliation,
  };
}
