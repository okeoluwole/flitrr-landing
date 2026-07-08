/**
 * STACK funding engine, the public entry point (Bucket 1).
 *
 * `computeAppraisal` takes one input set and returns the whole result: the
 * derived switches, the funding stack, the sources and uses, the distribution
 * waterfall, the return metrics, the decision and verdict, the five-route
 * comparison, and the two sensitivity grids, plus the reconciliation invariants
 * that must read zero.
 *
 * This is the deterministic core. It is pure and framework-agnostic, so it runs
 * server-side only and is never shipped to the browser, which is what keeps the
 * modelling on the platform. The front end calls it through a server action; it
 * has no DB, no React, no network and no system clock.
 *
 * Re-exports the input contract so callers have one import point.
 */

import { deriveSwitches } from './inputs.js';
import { fundingSummary } from './seniorDebt.js';
import { sourcesAndUses } from './sizing.js';
import { distributionWaterfall } from './waterfall.js';
import { returnsAndMetrics } from './returns.js';
import { decisionBand, verdictSentence } from './verdict.js';
import { fundingComparison } from './comparison.js';
import { viabilityGrid, jvTermsGrid } from './sensitivity.js';

export {
  baseCaseInputs,
  deriveSwitches,
  resolveCurrencySymbol,
  FUNDING_STRATEGY,
  DEBT_STRUCTURE,
  JV_PARTNER_CONTRIBUTES,
  PROMOTE_HURDLE_BASIS,
  INTEREST_BASIS,
  BUILD_DRAWDOWN_PROFILE,
  FUNDING_SEQUENCE,
  CURRENCY_SYMBOLS,
  YES,
  NO,
} from './inputs.js';

/**
 * Compute the full development appraisal and funding result for an input set.
 *
 * @param {object} inputs a complete input set, e.g. from `baseCaseInputs`
 * @returns {object} the full result, including an `invariants` block whose three
 *   reconciliations must read zero
 */
export function computeAppraisal(inputs) {
  const switches = deriveSwitches(inputs);
  const funding = fundingSummary(inputs, switches);
  const waterfall = distributionWaterfall(inputs, switches, funding);
  const returns = returnsAndMetrics(inputs, switches, funding, waterfall);
  const sources = sourcesAndUses(inputs, switches, funding);
  const decision = decisionBand(inputs, returns);
  const verdict = verdictSentence(inputs, funding, returns);
  const comparison = fundingComparison(inputs, funding, waterfall, returns);
  const sensitivity = {
    viability: viabilityGrid(inputs, funding),
    jvTerms: jvTermsGrid(inputs, waterfall),
  };

  return {
    switches,
    funding,
    sourcesAndUses: sources,
    waterfall,
    returns,
    decision,
    verdict,
    comparison,
    sensitivity,
    invariants: {
      cashUsesReconciliation: funding.cashUsesReconciliation, // Engine B26
      waterfallReconciliation: waterfall.reconciliation, // Waterfall F39
      sourcesLessUses: sources.sourcesLessUses, // Summary E25
    },
  };
}
