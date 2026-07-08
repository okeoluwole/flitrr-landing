/**
 * STACK funding engine, returns and metrics (Bucket 1, sub-step 1.6).
 *
 * This is where the headline lands: the project profit of 614,633, the profit on
 * cost, the go or no-go margin, and the return metrics. It reproduces the Engine
 * tab's time-based returns block (rows 33 to 53) and the Summary's return metrics
 * and residual land value.
 *
 * The metrics come in three views: the project (unlevered, before finance),
 * equity (levered, after debt), and equity after tax. Each is the internal rate
 * of return and the equity multiple of a monthly cash-flow vector, plus the
 * per-party returns for the joint venture. The IRR matches Excel's periodic IRR,
 * annualised by compounding, so parity holds against the workbook.
 *
 * The residual land value is indicative by design: it holds finance and non-land
 * costs at the current run rather than solving the finance feedback by iteration,
 * which STACK avoids to stay deterministic.
 */

import { YES } from './inputs.js';

/**
 * Net present value of a monthly cash-flow vector at a monthly rate, with the
 * first entry at period zero (undiscounted), matching Excel's IRR convention.
 *
 * @param {number} rate monthly rate
 * @param {number[]} cashflows monthly cash flows, first at period zero
 * @returns {number}
 */
function npv(rate, cashflows) {
  let total = 0;
  for (let i = 0; i < cashflows.length; i += 1) {
    total += cashflows[i] / Math.pow(1 + rate, i);
  }
  return total;
}

/**
 * The internal rate of return per period (Excel IRR). Newton-Raphson from the
 * guess, with a bracketed bisection fallback so it converges even for the very
 * high per-party rates. Returns null when there is no sign change, the analogue
 * of the workbook's IFERROR to "n/a".
 *
 * @param {number[]} cashflows monthly cash flows, first at period zero
 * @param {number} [guess] starting rate, matching the workbook's 0.02
 * @returns {number|null} the monthly rate, or null when undefined
 */
export function irr(cashflows, guess = 0.02) {
  let rate = guess;
  for (let iter = 0; iter < 100; iter += 1) {
    let f = 0;
    let df = 0;
    for (let i = 0; i < cashflows.length; i += 1) {
      const base = Math.pow(1 + rate, i);
      f += cashflows[i] / base;
      df += (-i * cashflows[i]) / (base * (1 + rate));
    }
    if (Math.abs(f) < 1e-9) return rate;
    if (df === 0) break;
    const next = rate - f / df;
    if (!Number.isFinite(next) || next <= -1) break;
    if (Math.abs(next - rate) < 1e-12) return next;
    rate = next;
  }

  // Bisection fallback over a wide bracket.
  let lo = -0.9999;
  let hi = 100;
  let flo = npv(lo, cashflows);
  let fhi = npv(hi, cashflows);
  if (flo * fhi > 0) return null;
  for (let iter = 0; iter < 300; iter += 1) {
    const mid = (lo + hi) / 2;
    const fmid = npv(mid, cashflows);
    if (Math.abs(fmid) < 1e-9) return mid;
    if (flo * fmid < 0) {
      hi = mid;
      fhi = fmid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * The annualised IRR, compounding the monthly rate: (1 + monthly)^12 - 1.
 *
 * @param {number[]} cashflows monthly cash flows
 * @param {number} [guess] starting rate
 * @returns {number|null} the annual rate, or null when undefined
 */
export function annualisedIrr(cashflows, guess = 0.02) {
  const monthly = irr(cashflows, guess);
  return monthly === null ? null : Math.pow(1 + monthly, 12) - 1;
}

/**
 * The equity multiple: total inflows divided by total outflows (Engine SUMIF
 * ratio). Null when there are no outflows.
 *
 * @param {number[]} cashflows monthly cash flows
 * @returns {number|null}
 */
export function equityMultiple(cashflows) {
  let inflows = 0;
  let outflows = 0;
  for (const cf of cashflows) {
    if (cf > 0) inflows += cf;
    else if (cf < 0) outflows += cf;
  }
  return outflows === 0 ? null : inflows / -outflows;
}

/**
 * Assemble the return metrics from the funding summary and the waterfall.
 *
 * @param {object} inputs a full input set
 * @param {object} switches the derived switches
 * @param {object} funding the funding summary from `fundingSummary`
 * @param {object} waterfall the waterfall from `distributionWaterfall`
 * @returns {object} profits, profit on cost and GDV, the three IRR-and-multiple
 *   views, the per-party IRRs, the residual land value, the break-even headroom,
 *   and the monthly cash-flow vectors that back them
 */
export function returnsAndMetrics(inputs, switches, funding, waterfall) {
  const { ndv } = funding;
  const { totalProjectCost } = funding.totals;
  const financeCost = funding.totalFinanceCost;
  const costPlusFinance = totalProjectCost + financeCost;

  const projectProfitUnlevered = ndv - totalProjectCost; // Summary M7
  const projectProfit = ndv - costPlusFinance; // Summary M8, the headline
  const corporationTax = Math.max(0, projectProfit) * inputs.corporationTaxRate; // Engine B43
  const afterTaxProjectProfit = projectProfit - corporationTax; // Summary M9 / B44

  const profitOnCost = projectProfit / costPlusFinance; // Summary B32
  const profitOnGdv = projectProfit / inputs.gdv; // Summary E32

  // Monthly cash-flow vectors (Engine rows 34 to 36, 47 to 49).
  const saleIndex = inputs.completionSaleMonth - 1;
  const contributedLand = switches.landContributedEquity ? inputs.landValue : 0;
  const sponsorLand = inputs.ownLand === YES ? inputs.landValue : 0;
  const proceedsToEquity = waterfall.proceedsToEquity;
  const netSaleAtCompletion = ndv - funding.presaleReduction;
  const partnerSplit = switches.partnerCashSplitEffective;

  const unleveredCashflow = [];
  const leveredCashflow = [];
  const afterTaxCashflow = [];
  const sponsorCashflow = [];
  const partnerCashflow = [];
  const landownerCashflow = [];

  for (let idx = 0; idx < inputs.programmeMonths; idx += 1) {
    const month = idx + 1;
    const isSale = idx === saleIndex;
    const isFirst = idx === 0;
    const cashEquityDraw = funding.cashEquityDrawVector[idx];
    const presale = funding.presaleVector[idx];

    // Unlevered project cash flow, land counted at value, ex finance.
    const unleveredCost = funding.costVector[idx] + (isFirst ? contributedLand : 0);
    const salesIn = presale + (isSale ? netSaleAtCompletion : 0);
    unleveredCashflow.push(salesIn - unleveredCost);

    // Levered equity cash flow: equity draws and contributed land out, the net
    // proceeds to equity in at completion.
    const levered =
      -cashEquityDraw -
      (isFirst ? contributedLand : 0) +
      (isSale ? proceedsToEquity : 0);
    leveredCashflow.push(levered);
    afterTaxCashflow.push(levered - (isSale ? corporationTax : 0));

    // Per-party cash flows for the joint venture.
    sponsorCashflow.push(
      -cashEquityDraw * (1 - partnerSplit) -
        (isFirst ? sponsorLand : 0) +
        (isSale ? waterfall.parties.sponsor.cash : 0),
    );
    partnerCashflow.push(
      -cashEquityDraw * partnerSplit + (isSale ? waterfall.parties.partner.cash : 0),
    );
    landownerCashflow.push(
      -(isFirst ? waterfall.capital.landowner : 0) +
        (isSale ? waterfall.parties.landowner.cash : 0),
    );
  }

  // Residual land value (Summary B35): the most a developer can pay for the land
  // and still hit the target profit on cost, holding finance and non-land costs.
  const residualLandValue =
    ndv / (1 + inputs.targetProfitOnCost) - financeCost - (totalProjectCost - inputs.landValue);

  return {
    projectProfitUnlevered,
    projectProfit,
    corporationTax,
    afterTaxProjectProfit,
    profitOnCost,
    profitOnGdv,

    project: {
      irr: annualisedIrr(unleveredCashflow), // B38
      multiple: equityMultiple(unleveredCashflow), // B39
      profit: projectProfitUnlevered, // M7
    },
    equity: {
      irr: annualisedIrr(leveredCashflow), // B40
      multiple: equityMultiple(leveredCashflow), // B41
      profit: projectProfit, // M8
    },
    afterTax: {
      irr: annualisedIrr(afterTaxCashflow), // B45
      multiple: equityMultiple(afterTaxCashflow), // B46
      profit: afterTaxProjectProfit, // M9
    },
    perParty: {
      sponsorIrr: annualisedIrr(sponsorCashflow), // B51
      partnerIrr: annualisedIrr(partnerCashflow), // B52
      landownerIrr: annualisedIrr(landownerCashflow), // B53
    },

    residualLandValue,
    breakEven: {
      gdvFallToBreakEven: projectProfit / ndv, // Sensitivity B32
      costOverrunToBreakEven: profitOnCost, // Sensitivity B33
      gdvAtBreakEven: costPlusFinance / (1 - inputs.salesCostsRate), // Sensitivity B34
      marginVsTarget: profitOnCost - inputs.targetProfitOnCost, // Sensitivity B35
    },

    cashflows: {
      unlevered: unleveredCashflow,
      levered: leveredCashflow,
      afterTax: afterTaxCashflow,
      sponsor: sponsorCashflow,
      partner: partnerCashflow,
      landowner: landownerCashflow,
    },
  };
}
