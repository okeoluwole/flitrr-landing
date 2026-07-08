/**
 * STACK funding engine, the sensitivity grids (Bucket 1, sub-step 1.9).
 * The workbook's Sensitivity tab, the two grids that re-derive live.
 *
 * Grid 1, scheme viability: how the profit on cost moves as the GDV (across) and
 * the build cost (down) move, holding finance, fees, statutory and land at the
 * base run. It answers "does the scheme still stack up if the market or the
 * build moves against me".
 *
 * Grid 2, the joint venture deal terms: how the sponsor's return multiple moves
 * as the preferred return (down) and the promote (across) move, holding the
 * proceeds and the capital at the base run so it isolates the split. It answers
 * "how do the deal terms change what I keep".
 *
 * Both are pure re-derivations, not native spreadsheet data tables, so they
 * recalculate cleanly and deterministically.
 */

// The grid axes the workbook uses (Sensitivity row 9, column A; row 22, column A).
const BUILD_DELTAS = [-0.1, -0.05, 0, 0.05, 0.1, 0.15]; // down, build cost move
const GDV_DELTAS = [-0.1, -0.05, 0, 0.05, 0.1]; // across, GDV move
const PREF_RATES = [0.06, 0.08, 0.1, 0.12, 0.15]; // down, preferred return
const PROMOTE_SHARES = [0.3, 0.4, 0.5, 0.6, 0.7]; // across, promote to sponsor

/**
 * Grid 1: profit on cost as build cost and GDV move (Sensitivity grid 1).
 * Finance, fees, statutory and land are held at the base run.
 *
 * @param {object} inputs a full input set
 * @param {object} funding the funding summary (for the base finance cost)
 * @returns {{ buildDeltas: number[], gdvDeltas: number[], grid: number[][] }}
 *   grid[i][j] is the profit on cost at buildDeltas[i], gdvDeltas[j]
 */
export function viabilityGrid(inputs, funding) {
  // Non-build costs held at the base run: fees, statutory, acquisition, the
  // development fee, land, and the finance cost.
  const heldCosts =
    inputs.professionalFees +
    inputs.statutory +
    inputs.acquisitionLegal +
    funding.totals.devManagementFee +
    inputs.landValue +
    funding.totalFinanceCost;

  const grid = BUILD_DELTAS.map((buildDelta) =>
    GDV_DELTAS.map((gdvDelta) => {
      const cost = inputs.constructionCost * (1 + buildDelta) + heldCosts;
      const ndv = inputs.gdv * (1 + gdvDelta) * (1 - inputs.salesCostsRate);
      return (ndv - cost) / cost;
    }),
  );

  return { buildDeltas: BUILD_DELTAS, gdvDeltas: GDV_DELTAS, grid };
}

/**
 * Grid 2: the sponsor's return multiple as the preferred return and the promote
 * move (Sensitivity grid 2). Proceeds and capital are held at the base run, so
 * the grid isolates the effect of the deal terms. The preferred return accrues
 * on the rate basis here, since the grid varies the rate.
 *
 * @param {object} inputs a full input set
 * @param {object} waterfall the waterfall (for capital and proceeds after capital)
 * @returns {{ prefRates: number[], promoteShares: number[], grid: number[][] }}
 *   grid[i][j] is the sponsor multiple at prefRates[i], promoteShares[j]
 */
export function jvTermsGrid(inputs, waterfall) {
  const sponsorCapital = waterfall.capital.sponsor;
  const partnerCapital = waterfall.capital.partner;
  const landownerCapital = waterfall.capital.landowner;
  const totalCapital = waterfall.capital.total;
  const proceedsAfterCapital = waterfall.proceedsAfterCapital; // F17
  const devManagementFee = waterfall.parties.sponsor.devFee;

  const cashPeriod =
    (inputs.completionSaleMonth -
      (inputs.constructionStartMonth + inputs.constructionEndMonth) / 2) /
    12;
  const landPeriod = inputs.completionSaleMonth / 12;

  const grid = PREF_RATES.map((pref) => {
    const cashFactor = (1 + pref) ** cashPeriod - 1;
    const landFactor = (1 + pref) ** landPeriod - 1;
    const sponsorPref = sponsorCapital * cashFactor;
    const partnerPref = partnerCapital * cashFactor;
    const landownerPref = landownerCapital * landFactor;
    const totalPref = sponsorPref + partnerPref + landownerPref;

    const prefPaidPool = Math.min(proceedsAfterCapital, totalPref);
    const sponsorPrefPaid = totalPref > 0 ? (prefPaidPool * sponsorPref) / totalPref : 0;
    const residual = Math.max(0, proceedsAfterCapital - prefPaidPool);

    return PROMOTE_SHARES.map((promote) => {
      const sponsorToCapital =
        totalCapital === 0 ? 0 : (residual * (1 - promote) * sponsorCapital) / totalCapital;
      const sponsorPromote = residual * promote;
      const sponsorTotal =
        sponsorCapital + sponsorPrefPaid + sponsorToCapital + sponsorPromote + devManagementFee;
      return sponsorCapital === 0 ? 0 : sponsorTotal / sponsorCapital;
    });
  });

  return { prefRates: PREF_RATES, promoteShares: PROMOTE_SHARES, grid };
}
