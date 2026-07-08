/**
 * STACK funding engine, the input contract (Bucket 1, sub-step 1.1).
 *
 * This is the single source of truth for what the STACK appraisal and funding
 * model takes in, and the first derivation it performs. It is the code form of
 * the workbook's Inputs tab: every field maps to a named input cell, and
 * `deriveSwitches` reproduces the "Strategy switches (derived, read only)" block
 * (Inputs C13 to C20) that turns the developer's plain choices into the flags
 * the rest of the engine reads.
 *
 * The engine is deterministic and framework-agnostic: pure functions, no DB, no
 * React, no network, no system clock. The same inputs always give the same
 * result, so the whole thing is unit-testable in isolation and runs server-side
 * only. Money is held as plain numbers in the reporting currency; the currency
 * is a display label, not an FX conversion (the workbook is currency-neutral).
 *
 * Cell references in the comments point at STACK_Funding_Engine_Final.xlsx, the
 * verified functional specification this engine reproduces exactly.
 *
 * House rules honoured here and throughout the engine: UK spelling, no em dashes
 * or en dashes, and the exact casing Flitrr, PULSE, ROUTE, STACK.
 */

// The funding strategy is the spine. It drives both what else is asked and how
// the result is computed (Inputs C5).
export const FUNDING_STRATEGY = {
  SELF_FUNDED: 'Self-funded',
  DEBT_FINANCED: 'Debt-financed',
  JOINT_VENTURE: 'Joint venture',
  OFF_PLAN: 'Off-plan',
};

// Debt structure, used on the Debt-financed route only (Inputs C6).
export const DEBT_STRUCTURE = {
  SENIOR_ONLY: 'Senior loan only',
  SENIOR_PLUS_MEZZ: 'Senior plus mezzanine',
};

// What a joint venture partner brings, used on the Joint venture route only
// (Inputs C7).
export const JV_PARTNER_CONTRIBUTES = {
  CASH: 'Cash',
  LAND: 'Land',
  BOTH: 'Both',
};

// The JV promote hurdle basis (Inputs C59). Preferred return uses the preferred
// return rate; Equity multiple uses the multiple hurdle.
export const PROMOTE_HURDLE_BASIS = {
  PREFERRED_RETURN: 'Preferred return',
  EQUITY_MULTIPLE: 'Equity multiple',
};

// Interest accrual basis (Inputs C89). Opening balance is the simple roll-up
// and keeps the schedule free of any circular reference. Average balance also
// charges half a month on each new drawdown.
export const INTEREST_BASIS = {
  OPENING_BALANCE: 'Opening balance',
  AVERAGE_BALANCE: 'Average balance',
};

// Build cost drawdown profile (Inputs C92). Even spreads the build equally;
// S-curve back-loads then tapers. Total build cost is unchanged either way.
export const BUILD_DRAWDOWN_PROFILE = {
  EVEN: 'Even',
  S_CURVE: 'S-curve',
};

// Funding sequence (Inputs C100). Debt first draws senior to its cap then
// equity; Equity first funds the front end from equity then draws senior for
// construction.
export const FUNDING_SEQUENCE = {
  DEBT_FIRST: 'Debt first',
  EQUITY_FIRST: 'Equity first',
};

// Yes/No choices are held as the literal strings the workbook uses, so the
// engine and the guided form share one vocabulary.
export const YES = 'Yes';
export const NO = 'No';

// Reporting currency (Inputs C78) and its symbol (Inputs C79, the CHOOSE/MATCH).
// The symbol is for display only; the figures never change with the currency.
export const CURRENCY_SYMBOLS = {
  GBP: '£', // pound
  USD: '$',
  EUR: '€', // euro
  NGN: '₦', // naira
  SAR: '﷼', // riyal
  CNY: '¥', // yuan
};

/**
 * Resolve the currency symbol for a reporting currency code (Inputs C79).
 * Falls back to the raw code when the currency is not in the known set, so the
 * banner still says something meaningful rather than throwing.
 *
 * @param {string} currency reporting currency code, e.g. 'GBP'
 * @returns {string} the symbol, e.g. the pound sign
 */
export function resolveCurrencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency;
}

/**
 * The base case: the workbook's saved Joint venture scheme, land-for-equity,
 * with senior debt alongside. Every figure here is a blue input cell from the
 * Inputs tab. This is the fixture the engine is measured against: it must
 * reproduce the known headline of about 614,633 project profit, and the model's
 * reconciliation cells must read zero.
 *
 * The default reporting currency is GBP, as in the brief. The saved workbook
 * instance reports in NGN, but because the currency is a label the figures are
 * identical whatever it is set to, so the base case reads GBP here.
 *
 * @returns {object} a complete, valid input set (a fresh object each call)
 */
export function baseCaseInputs() {
  return {
    // Funding strategy and its branch choices (Inputs C5 to C11, C21).
    fundingStrategy: FUNDING_STRATEGY.JOINT_VENTURE, // C5
    debtStructure: DEBT_STRUCTURE.SENIOR_ONLY, // C6
    jvPartnerContributes: JV_PARTNER_CONTRIBUTES.BOTH, // C7
    seniorAlongsideJv: YES, // C8
    ownLand: NO, // C9
    commencementDate: '2026-07-01', // C10, month 1 of the cashflow
    mezzanineInterestRate: 0.12, // C11, per annum
    mezzanineCombinedLtc: 0.75, // C21, senior plus mezzanine loan to cost

    // Scheme (Inputs C23 to C35).
    gdv: 3850000, // C23
    salesCostsRate: 0.02, // C24, agent and legal, deducted from GDV
    constructionCost: 2014249, // C26, all build elements
    professionalFees: 221567, // C27
    statutory: 48000, // C28, S106 / CIL and other
    acquisitionLegal: 7875, // C29
    landValue: 525000, // C30, agreed worth of the land
    sdlt: 26250, // C31, stamp duty if the land is a cash purchase
    programmeMonths: 30, // C32, total project length
    constructionStartMonth: 7, // C33
    constructionEndMonth: 27, // C34
    completionSaleMonth: 30, // C35, when the NDV is received

    // Funding terms (Inputs C38 to C47).
    devManagementFeeRate: 0.02, // C38, of GDV, paid to the sponsor
    seniorLtcCap: 0.6, // C39, loan to cost cap
    seniorLtgdvCap: 0.55, // C40, loan to GDV cap
    seniorInterestRate: 0.09, // C41, per annum, rolled up
    seniorArrangementFee: 0.015, // C42, of facility
    seniorExitFee: 0.01, // C43, on redemption
    preferredReturnRate: 0.1, // C44, per annum, JV hurdle
    cashEquityPartnerSplit: 0.7, // C45, share of cash equity the partner funds
    residualProfitToCapital: 0.5, // C46, pro-rata share of the residual
    targetProfitOnCost: 0.2, // C47, the go / no-go hurdle

    // JV promote hurdle (Inputs C59, C60).
    promoteHurdleBasis: PROMOTE_HURDLE_BASIS.PREFERRED_RETURN, // C59
    equityMultipleHurdle: 1.3, // C60, used only on the Equity multiple basis

    // Off-plan pre-sales (Inputs C63, C64).
    modelPresales: NO, // C63
    presaleProportionNdv: 0.5, // C64, share of net sales received across the build

    // Tax (Inputs C67).
    corporationTaxRate: 0.25, // C67, on project profit after finance

    // GP catch-up and carry, JV only (Inputs C70, C71).
    useGpCatchupCarry: NO, // C70
    carriedInterest: 0.2, // C71, GP carry

    // Scheme metrics, optional per-unit display (Inputs C74, C75). Null means
    // hide the per-unit columns.
    netSaleableArea: null, // C74, sq ft
    numberOfUnits: null, // C75

    // Currency (Inputs C78). Display label only.
    reportingCurrency: 'GBP', // C78

    // Contingency (Inputs C83).
    constructionContingency: 0, // C83, of build cost

    // Sell-down / void (Inputs C86).
    holdingCostPerMonth: 0, // C86, running cost per void month

    // Interest basis (Inputs C89).
    interestBasis: INTEREST_BASIS.OPENING_BALANCE, // C89

    // Construction profile (Inputs C92).
    buildDrawdownProfile: BUILD_DRAWDOWN_PROFILE.EVEN, // C92

    // Inflation / escalation (Inputs C95, C96).
    buildCostInflation: 0, // C95, per annum, to the construction midpoint
    salesValueGrowth: 0, // C96, per annum, grows GDV to the sale month

    // Funding sequence (Inputs C100).
    fundingSequence: FUNDING_SEQUENCE.DEBT_FIRST, // C100

    // Unit mix, optional (Inputs rows 104 to 109). Each entry is
    // { type, count, areaEach, priceEach }. Drives area and plots when present.
    unitMix: [],

    // Decision rule (Inputs C115).
    considerBand: 0.05, // C115, points below target that still reads CONSIDER
  };
}

/**
 * Derive the read-only strategy switches from the developer's choices. This is
 * the workbook's "Strategy switches (derived, read only)" block, Inputs C13 to
 * C20, reproduced exactly. These flags, not the raw strategy string, are what
 * the cost model, the debt schedule, the sizing and the waterfall branch on, so
 * every route is a configuration of one structure rather than a separate engine.
 *
 * The rules, cell by cell:
 *   C13 useSeniorDebt: none when Self-funded; on the JV route only when senior
 *       sits alongside the partner equity; otherwise on (Debt-financed).
 *   C14 useMezzanine: only Debt-financed with the senior-plus-mezzanine choice.
 *   C15 partnerProvidesCash: JV with the partner bringing Cash or Both.
 *   C16 partnerProvidesLand: JV with the partner bringing Land or Both.
 *   C17 landContributedEquity: the developer already owns the land, or a JV
 *       partner contributes it. Either way the land joins the waterfall as
 *       equity rather than being bought for cash.
 *   C18 landCashPurchase: the complement of C17. Land and SDLT become a cash
 *       cost funded by debt or equity.
 *   C19 partnerCashSplitEffective: the partner's share of cash equity, which is
 *       the cash equity split when the partner funds cash, and zero otherwise.
 *   C20 prefPromoteActive: the preferred return and promote apply on the JV
 *       route only.
 *
 * @param {object} inputs a full input set, e.g. from `baseCaseInputs`
 * @returns {{
 *   useSeniorDebt: boolean,
 *   useMezzanine: boolean,
 *   partnerProvidesCash: boolean,
 *   partnerProvidesLand: boolean,
 *   landContributedEquity: boolean,
 *   landCashPurchase: boolean,
 *   partnerCashSplitEffective: number,
 *   prefPromoteActive: boolean,
 * }}
 */
export function deriveSwitches(inputs) {
  const {
    fundingStrategy,
    debtStructure,
    jvPartnerContributes,
    seniorAlongsideJv,
    ownLand,
    cashEquityPartnerSplit,
  } = inputs;

  const isJv = fundingStrategy === FUNDING_STRATEGY.JOINT_VENTURE;

  // C13: senior debt is off for Self-funded, conditional on the JV route, on
  // for everything else (the Debt-financed and Off-plan routes).
  const useSeniorDebt =
    fundingStrategy === FUNDING_STRATEGY.SELF_FUNDED
      ? false
      : isJv
        ? seniorAlongsideJv === YES
        : true;

  // C14: mezzanine only on the Debt-financed senior-plus-mezzanine branch.
  const useMezzanine =
    fundingStrategy === FUNDING_STRATEGY.DEBT_FINANCED &&
    debtStructure === DEBT_STRUCTURE.SENIOR_PLUS_MEZZ;

  // C15 and C16: what a JV partner brings.
  const partnerProvidesCash =
    isJv &&
    (jvPartnerContributes === JV_PARTNER_CONTRIBUTES.CASH ||
      jvPartnerContributes === JV_PARTNER_CONTRIBUTES.BOTH);
  const partnerProvidesLand =
    isJv &&
    (jvPartnerContributes === JV_PARTNER_CONTRIBUTES.LAND ||
      jvPartnerContributes === JV_PARTNER_CONTRIBUTES.BOTH);

  // C17 and C18: land is contributed equity when the developer owns it or a
  // partner brings it; a cash purchase otherwise.
  const landContributedEquity = ownLand === YES || partnerProvidesLand;
  const landCashPurchase = !landContributedEquity;

  // C19: the partner's effective share of cash equity.
  const partnerCashSplitEffective = partnerProvidesCash
    ? cashEquityPartnerSplit
    : 0;

  // C20: the preferred return and promote apply on the JV route only.
  const prefPromoteActive = isJv;

  return {
    useSeniorDebt,
    useMezzanine,
    partnerProvidesCash,
    partnerProvidesLand,
    landContributedEquity,
    landCashPurchase,
    partnerCashSplitEffective,
    prefPromoteActive,
  };
}
