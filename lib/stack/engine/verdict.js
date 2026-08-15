/**
 * STACK funding engine, the verdict (Bucket 1, sub-step 1.7).
 *
 * The plain-English read a developer with only basic financial knowledge acts
 * on: a GO, CONSIDER or NO GO decision against the target profit on cost and the
 * consider band, and the one-paragraph sentence that explains it. This is the
 * workbook's Summary decision (A19), decision detail (A20), viability verdict
 * (K29) and headline sentence (A3), reproduced exactly, including the number
 * formatting so the wording matches to the character.
 *
 * The decision has three states; the sentence has five shades within them (a
 * strong go, a go, a marginal consider, a thin consider, a no go), which is why
 * the sentence tests the raw margin while the decision tests the banded margin.
 */

import { resolveCurrencySymbol } from './inputs.js';

// Excel ROUND, half away from zero, so the "points versus target" wording
// matches the sheet rather than JavaScript's half-to-even or half-up.
function excelRound(value, digits) {
  const factor = 10 ** digits;
  return (value < 0 ? -1 : 1) * (Math.round(Math.abs(value) * factor) / factor);
}

// TEXT(value,"#,##0"): rounded to a whole number with thousands separators.
function formatThousands(value) {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  return sign + Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// TEXT(value,"0.0%"): a percentage to one decimal place.
function formatPercent1(value) {
  return `${(value * 100).toFixed(1)}%`;
}

// TEXT(value,"0.0"): a number to one decimal place.
function formatOneDp(value) {
  return value.toFixed(1);
}

/**
 * The decision and its supporting reads (Summary A19, A20, K29).
 *
 * @param {object} inputs a full input set
 * @param {object} returns the return metrics from `returnsAndMetrics`
 * @returns {{
 *   decision: 'GO'|'CONSIDER'|'NO GO',
 *   marginVsTarget: number,
 *   pointsVsTarget: number,
 *   aboveTarget: boolean,
 *   viability: string,
 * }}
 */
export function decisionBand(inputs, returns) {
  const { projectProfit, profitOnCost } = returns;
  const target = inputs.targetProfitOnCost;
  const band = inputs.considerBand;

  let decision;
  if (projectProfit <= 0) decision = 'NO GO';
  else if (profitOnCost >= target) decision = 'GO';
  else if (profitOnCost >= target - band) decision = 'CONSIDER';
  else decision = 'NO GO';

  const pointsVsTarget = excelRound(profitOnCost * 100, 1) - excelRound(target * 100, 1);

  return {
    decision,
    marginVsTarget: profitOnCost - target,
    pointsVsTarget,
    aboveTarget: pointsVsTarget > 0,
    viability: profitOnCost >= target ? 'On or above target' : 'Below target',
  };
}

/**
 * The headline verdict sentence (Summary A3). Deterministic prose, every figure
 * traceable to the result.
 *
 * @param {object} inputs a full input set
 * @param {object} funding the funding summary (for the NDV in the cushion line)
 * @param {object} returns the return metrics from `returnsAndMetrics`
 * @returns {string} the plain-English verdict
 */
export function verdictSentence(inputs, funding, returns) {
  const { projectProfit, profitOnCost } = returns;
  const target = inputs.targetProfitOnCost;
  const band = inputs.considerBand;
  const symbol = resolveCurrencySymbol(inputs.reportingCurrency);
  const margin = profitOnCost - target;

  let sentence =
    `This scheme is funded by ${inputs.fundingStrategy} and makes about ` +
    `${symbol}${formatThousands(projectProfit)} profit, a ${formatPercent1(profitOnCost)} profit on cost. `;

  const points = excelRound(profitOnCost * 100, 1) - excelRound(target * 100, 1);
  if (points === 0) {
    sentence += `That is in line with your ${formatPercent1(target)} target.`;
  } else {
    sentence +=
      `That is ${formatOneDp(Math.abs(points))} points ${points > 0 ? 'above' : 'below'} ` +
      `your ${formatPercent1(target)} target.`;
  }
  sentence += ' ';

  if (projectProfit <= 0) {
    sentence += 'On these numbers the scheme loses money, so this is a No Go.';
  } else if (margin >= band) {
    sentence += 'That comfortably clears your hurdle, a strong margin, so this looks like a Go.';
  } else if (margin >= 0) {
    sentence += 'That clears your hurdle, so this is a Go.';
  } else if (margin >= -band / 2) {
    sentence += 'That is marginally under your target, broadly in line, so treat it as Consider.';
  } else if (margin >= -band) {
    sentence +=
      'That is below your target, so the margin is thinner than you would like, a Consider.';
  } else {
    sentence +=
      'That is well short of your hurdle, the numbers do not work as they stand, so this is a No Go.';
  }

  if (projectProfit > 0) {
    sentence +=
      ` As a safety cushion, sale values could come in about ` +
      `${formatPercent1(projectProfit / funding.ndv)} below plan before the profit disappears.`;
  }

  return sentence;
}
