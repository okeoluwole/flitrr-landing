/**
 * STACK funding engine, the distribution waterfall (Bucket 1, sub-step 1.5).
 * The workbook's Waterfall tab, reproduced exactly.
 *
 * Net proceeds repay the senior, mezzanine and any pre-sale reduction, then flow
 * through three tiers: return of capital pro-rata, a preferred return, and the
 * residual split with a sponsor promote (or, optionally, an institutional GP
 * catch-up then carry). Land-for-equity is handled as a capital contribution at
 * valuation, so the landowner joins the waterfall and is paid a share of profit,
 * not a cash sale.
 *
 * What makes it deterministic: the preferred return accrues on contributed
 * capital as a balance (cash from mid-build, land from the outset), and the
 * promote is on profit hurdles, not IRR hurdles, so the engine derives every
 * figure rather than solving for one. With no partner the pref and promote are
 * inactive and the whole residual falls to the developer.
 *
 * The reconciliation (Waterfall F39): the net development value equals the
 * senior redemption plus every distribution. It reads zero. The development fee
 * is excluded from it, being a cost already funded, not a share of proceeds.
 */

import { YES, PROMOTE_HURDLE_BASIS } from './inputs.js';

/**
 * Run the distribution waterfall for the selected route.
 *
 * @param {object} inputs a full input set
 * @param {object} switches the derived switches from `deriveSwitches`
 * @param {object} funding the funding summary from `fundingSummary`
 * @returns {object} the capital contributed, the tier flows, the per-party
 *   outcomes (received, profit, multiple), and the reconciliation
 */
export function distributionWaterfall(inputs, switches, funding) {
  const { totals, ndv } = funding;
  const { landValue } = inputs;
  const ownsLand = inputs.ownLand === YES;

  // Capital contributed by party (Waterfall row 6). The sponsor's land counts as
  // capital when the developer owns it; the landowner's land counts when a JV
  // partner brings it and the developer does not own it.
  const sponsorCapital = funding.sponsorCashEquity + (ownsLand ? landValue : 0);
  const partnerCapital = funding.partnerCashEquity;
  const landownerCapital = switches.partnerProvidesLand && !ownsLand ? landValue : 0;
  const totalCapital = sponsorCapital + partnerCapital + landownerCapital;

  // Proceeds available to equity (rows 10 to 12). The pre-sale reduction and the
  // void holding cost are netted here alongside the senior and mezzanine.
  const seniorMezzAndOther =
    funding.seniorRedemption +
    funding.mezzanineRedemption +
    funding.presaleReduction +
    funding.voidHolding;
  const proceedsToEquity = ndv - seniorMezzAndOther; // F12

  // A pro-rata share of a pool by contributed capital, safe when there is none.
  const proRata = (pool, capital) => (totalCapital === 0 ? 0 : (pool * capital) / totalCapital);

  // Tier 1, return of capital (rows 15 to 17).
  const returnOfCapitalPool = Math.min(proceedsToEquity, totalCapital); // F15
  const sponsorReturnOfCapital = proRata(returnOfCapitalPool, sponsorCapital);
  const partnerReturnOfCapital = proRata(returnOfCapitalPool, partnerCapital);
  const landownerReturnOfCapital = proRata(returnOfCapitalPool, landownerCapital);
  const proceedsAfterCapital = proceedsToEquity - returnOfCapitalPool; // F17

  // Tier 2, the return hurdle (rows 20 to 23). Cash accrues over the period from
  // mid-build to sale; land accrues from the outset. On the equity-multiple
  // basis the hurdle is a flat multiple rather than a compounding rate.
  const cashPeriod =
    (inputs.completionSaleMonth -
      (inputs.constructionStartMonth + inputs.constructionEndMonth) / 2) /
    12; // C20 / D20
  const landPeriod = inputs.completionSaleMonth / 12; // E20
  const prefActive = switches.prefPromoteActive ? 1 : 0;
  const equityMultipleBasis =
    inputs.promoteHurdleBasis === PROMOTE_HURDLE_BASIS.EQUITY_MULTIPLE;
  const prefFactor = (period) =>
    equityMultipleBasis
      ? inputs.equityMultipleHurdle - 1
      : Math.pow(1 + inputs.preferredReturnRate, period) - 1;

  const sponsorPrefAccrued = prefActive * sponsorCapital * prefFactor(cashPeriod);
  const partnerPrefAccrued = prefActive * partnerCapital * prefFactor(cashPeriod);
  const landownerPrefAccrued = prefActive * landownerCapital * prefFactor(landPeriod);
  const totalPrefAccrued = sponsorPrefAccrued + partnerPrefAccrued + landownerPrefAccrued; // F21

  const prefPaidPool = Math.min(proceedsAfterCapital, totalPrefAccrued);
  const prefShare = (accrued) =>
    totalPrefAccrued === 0 ? 0 : (prefPaidPool * accrued) / totalPrefAccrued;
  const sponsorPrefPaid = prefShare(sponsorPrefAccrued);
  const partnerPrefPaid = prefShare(partnerPrefAccrued);
  const landownerPrefPaid = prefShare(landownerPrefAccrued);
  const proceedsAfterPref = proceedsAfterCapital - prefPaidPool; // F23

  // Tier 3, residual profit and the sponsor promote, or GP catch-up and carry
  // when that is switched on (rows 26 to 29).
  const residual = Math.max(0, proceedsAfterPref); // F26
  const useCatchup = inputs.useGpCatchupCarry === YES;
  const carry = inputs.carriedInterest;
  // GP catch-up (memo, C29): the GP takes residual until it holds the carry share
  // of the profit above capital, measured against the limited partners' pref.
  const catchup = useCatchup
    ? Math.min(residual, (carry / (1 - carry)) * (partnerPrefPaid + landownerPrefPaid))
    : 0;
  const toCapitalShare = (capital) => {
    if (totalCapital === 0) return 0;
    if (useCatchup) {
      return ((residual - catchup) * (1 - carry) * capital) / totalCapital;
    }
    return (residual * inputs.residualProfitToCapital * capital) / totalCapital;
  };
  const sponsorToCapital = toCapitalShare(sponsorCapital);
  const partnerToCapital = toCapitalShare(partnerCapital);
  const landownerToCapital = toCapitalShare(landownerCapital);
  const totalToCapital = sponsorToCapital + partnerToCapital + landownerToCapital; // F27
  const promoteToSponsor = residual - totalToCapital; // C28 / F28

  // Party outcomes (rows 31 to 36). The development fee is sponsor income on top
  // of the waterfall; it is not a share of proceeds.
  const devManagementFee = totals.devManagementFee; // C31
  const sponsorReceived =
    sponsorReturnOfCapital + sponsorPrefPaid + sponsorToCapital + promoteToSponsor; // C32
  const partnerReceived = partnerReturnOfCapital + partnerPrefPaid + partnerToCapital; // D32
  const landownerReceived =
    landownerReturnOfCapital + landownerPrefPaid + landownerToCapital; // E32

  const party = (capital, received, fee) => {
    const cash = received + fee; // C33 / D33 / E33
    return {
      capital,
      received,
      devFee: fee,
      cash,
      profit: cash - capital, // C35 / D35 / E35
      multiple: capital === 0 ? 0 : cash / capital, // C36 / D36 / E36
    };
  };

  // Reconciliation (F39): NDV less senior redemption and every waterfall take,
  // the fee excluded. Reads zero.
  const reconciliation =
    ndv - (seniorMezzAndOther + sponsorReceived + partnerReceived + landownerReceived);

  return {
    capital: {
      sponsor: sponsorCapital,
      partner: partnerCapital,
      landowner: landownerCapital,
      total: totalCapital,
    },
    proceedsToEquity,
    returnOfCapitalPool,
    proceedsAfterCapital,
    prefAccrued: {
      sponsor: sponsorPrefAccrued,
      partner: partnerPrefAccrued,
      landowner: landownerPrefAccrued,
      total: totalPrefAccrued,
    },
    prefPaidPool,
    proceedsAfterPref,
    residual,
    catchup,
    totalToCapital,
    promoteToSponsor,
    parties: {
      sponsor: party(sponsorCapital, sponsorReceived, devManagementFee),
      partner: party(partnerCapital, partnerReceived, 0),
      landowner: party(landownerCapital, landownerReceived, 0),
    },
    reconciliation,
  };
}
