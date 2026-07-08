/**
 * STACK funding engine, sources and uses (Bucket 1, sub-step 1.4).
 *
 * The funding stack the developer sees: what the project spends (uses) and where
 * the money comes from (sources). This is the workbook's Summary "Sources and
 * Uses" block (D5 to E25). The sizing itself, the senior facility, the cash
 * equity and its sponsor and partner split, and the mezzanine, is computed in
 * the funding summary; this module presents it as the two balancing columns and
 * exposes the sources-equals-uses check.
 *
 * Land is always counted in the uses at its valuation, once. SDLT is a use only
 * when the land is bought for cash. Total sources equal total uses by
 * construction, so `sourcesLessUses` reads zero for every route.
 */

/**
 * Assemble the sources and uses from a funding summary.
 *
 * @param {object} inputs a full input set
 * @param {object} switches the derived switches from `deriveSwitches`
 * @param {object} funding the funding summary from `fundingSummary`
 * @returns {{
 *   uses: object,
 *   sources: object,
 *   sourcesLessUses: number,
 * }}
 */
export function sourcesAndUses(inputs, switches, funding) {
  const { totals } = funding;

  const uses = {
    landAtValue: inputs.landValue, // Summary E8, always at valuation
    sdlt: switches.landCashPurchase ? inputs.sdlt : 0, // E9, only on a cash purchase
    construction: totals.effectiveBuild, // E10
    professionalFees: inputs.professionalFees, // E11
    statutory: inputs.statutory, // E12
    acquisitionLegal: inputs.acquisitionLegal, // E13
    devManagementFee: totals.devManagementFee, // E14
  };
  uses.total =
    uses.landAtValue +
    uses.sdlt +
    uses.construction +
    uses.professionalFees +
    uses.statutory +
    uses.acquisitionLegal +
    uses.devManagementFee; // E15, equals total project cost

  const sources = {
    seniorDebt: funding.totalSeniorDrawn, // Summary E18
    mezzanine: funding.mezzanineFacility, // E19
    presaleReceipts: funding.presaleReduction, // E20
    sponsorEquity: funding.sponsorCashEquity, // E21
    partnerEquity: funding.partnerCashEquity, // E22
    contributedLand: switches.landContributedEquity ? inputs.landValue : 0, // E23
  };
  sources.total =
    sources.seniorDebt +
    sources.mezzanine +
    sources.presaleReceipts +
    sources.sponsorEquity +
    sources.partnerEquity +
    sources.contributedLand; // E24

  const sourcesLessUses = sources.total - uses.total; // E25, reads zero

  return { uses, sources, sourcesLessUses };
}
