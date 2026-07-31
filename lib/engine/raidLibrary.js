/**
 * The RAID candidate library (Note 7). Condition-tagged CONTENT, not code.
 *
 * THE DEFECT THIS CLOSES. Step 8 offered three risks: planning permission
 * delayed, construction costs exceed budget, funding delayed. The same three
 * appear on every project, in every country, under every funding structure,
 * because they were a flat array with no condition on anything the developer
 * had just spent eight steps recording. A twelve-unit Lagos off-plan scheme
 * with Cost, Time and Funding all non-negotiable was offered exactly what a
 * self-funded Yorkshire barn conversion was offered. The suggestions a
 * developer actually needs are the ones a generic list misses.
 *
 * WHAT A CANDIDATE IS. A frozen literal, written here by hand, carrying:
 *
 *   key         a stable identifier, so a candidate can be referenced without
 *               its text (the text is content and may be reworded).
 *   type        risk | assumption | constraint | dependency.
 *   dimension   the objective_type this bears on. It resolves to the PROJECT'S
 *               own objective of that dimension, or to no proposal at all
 *               (raidSuggestions.js). It never names an objective directly.
 *   when        the condition over RECORDED BASELINE FACTS under which this
 *               applies. Declarative data, evaluated by the selector, never a
 *               function: a condition that can run arbitrary code is code.
 *   text        the candidate's wording, with substitution tokens for recorded
 *               values and for geography-expressed wording.
 *
 * NOTHING HERE ASSERTS A FIGURE, A PROBABILITY OR AN OPINION. Where a recorded
 * value appears in the text it is substituted from the baseline; where a
 * jurisdictional mechanism appears it is read from the geography configuration
 * (Session F) rather than named here. A candidate whose tokens cannot all be
 * resolved from the baseline is DROPPED rather than rendered with a gap, which
 * is the rule that keeps a suggestion from asserting something the inputs do
 * not carry.
 *
 * SUBSTITUTION TOKENS, and the only ones there are:
 *   {{hint:N}}    the stage N location-sensitive hint LABEL, read from the
 *                 geography-expressed programme template (geographyTemplate).
 *                 This is how a geography-dependent candidate gets its wording
 *                 without a second country branch anywhere. The labels are
 *                 capitalised noun phrases, so a candidate using one puts it at
 *                 the head of the sentence where it reads as its own subject.
 *   {{currency}}  projects.currency.
 *   {{stage:N}}   the stage's own framework name.
 *
 * THE STARTER LIBRARY IS A BEGINNING. It covers the test project's shape well
 * enough to prove the mechanism and keeps the United Kingdom and the neutral
 * expressions honest. Where it is thin is recorded at the foot of this file so
 * the content can be authored from the domain side rather than guessed at here.
 *
 * Pure frozen data. No DB, no React, no network, no clock.
 */

// The four RAID types, in the order the Step 8 surface lists them.
export const RAID_TYPES = Object.freeze({
  RISK: 'risk',
  ASSUMPTION: 'assumption',
  CONSTRAINT: 'constraint',
  DEPENDENCY: 'dependency',
});

export const RAID_TYPE_ORDER = Object.freeze([
  RAID_TYPES.RISK,
  RAID_TYPES.ASSUMPTION,
  RAID_TYPES.CONSTRAINT,
  RAID_TYPES.DEPENDENCY,
]);

// Deep freeze, so a consumer genuinely cannot mutate the library it is handed.
// Mirrors the programme template's and the geography configuration's own guard.
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/**
 * THE CONDITION VOCABULARY, and nothing beyond it. Every clause names one
 * recorded baseline fact and the values it fires on. The selector evaluates
 * these and nothing else; it cannot compute, infer or judge, because there is
 * no clause that would let it.
 *
 *   countryIn            projects.country is one of these
 *   currencyIn           projects.currency is one of these
 *   fundingStructureIn   project_budget.funding_structure_type is one of these
 *   procurementRouteIn   projects.procurement_route is one of these
 *   planningStatusIn     project_scope_site.planning_status is one of these
 *   nonNegotiable        every one of these objective_types is classified
 *                        non-negotiable on this project
 *   flexible             every one of these objective_types is classified
 *                        flexible on this project
 *   hasFundingMilestones the project recorded at least one funding milestone
 *   stageUnderTypical    the recorded gate window for this stage is shorter
 *                        than the geography-expressed template's own curated
 *                        span for it. A comparison of a recorded date against a
 *                        curated constant, not a judgement about the programme.
 *   stagesAhead          at least one of these stages is at or after the
 *                        project's declared entry stage (Note 12). A candidate
 *                        whose stage completed before adoption is not offered.
 *                        A scoping filter, not a reason, so it is never worded
 *                        into a basis, exactly as scopeSuggestions strips its
 *                        own stage tag today.
 *
 * A clause the library omits is not evaluated. An ABSENT recorded fact makes
 * its clause false, never true: a project that has not reached Step 6 is not
 * offered a funding-structure candidate on the strength of a blank.
 */

const LIBRARY = [
  // ── Risks ──────────────────────────────────────────────────────────────

  // The test's own case. Off-plan presales fund the build from buyer deposits,
  // so the drawdown the programme assumes is a function of sales absorption.
  // Recorded facts only: the funding structure, and the stages still ahead.
  {
    key: 'offplan_absorption_behind_drawdown',
    type: RAID_TYPES.RISK,
    dimension: 'funding',
    when: {
      fundingStructureIn: ['off_plan_presales'],
      stagesAhead: [3, 4, 5, 6, 7],
    },
    text: 'Off-plan sales absorption runs slower than the drawdown the programme assumes',
  },

  // The second half of the same structure: presales set the price before the
  // cost is known, so a cost movement cannot be passed on.
  {
    key: 'offplan_price_fixed_before_cost',
    type: RAID_TYPES.RISK,
    dimension: 'cost',
    when: {
      fundingStructureIn: ['off_plan_presales'],
      nonNegotiable: ['cost'],
      stagesAhead: [3, 4, 5, 6, 7],
    },
    text: 'Off-plan prices are committed before the construction cost is fixed, so a cost movement cannot be passed to buyers',
  },

  // Currency. Fires on the recorded reporting currency, not on the country: a
  // scheme reporting in Naira carries imported-material and foreign-currency
  // finance exposure whoever is building it, and a Nigerian scheme reporting in
  // Dollars does not carry it in the same direction. The text names the recorded
  // currency and asserts no rate, no direction and no figure.
  {
    key: 'currency_movement_imported_costs',
    type: RAID_TYPES.RISK,
    dimension: 'cost',
    when: {
      currencyIn: ['NGN'],
      stagesAhead: [3, 4, 5, 6, 7],
    },
    text: 'Currency movement raises the {{currency}} cost of imported materials and of any finance priced in another currency',
  },

  // Geography-dependent, and the reason the whole templating mechanism exists.
  // The wording of the consent mechanism is READ from the geography-expressed
  // programme template, so Nigeria says "State physical planning permit", the
  // United Kingdom says "Planning approval" and an unconfigured country says
  // "Development approval". There is no country branch here.
  {
    key: 'consent_determination_beyond_programme',
    type: RAID_TYPES.RISK,
    dimension: 'time',
    when: {
      planningStatusIn: [
        'no_application',
        'pre_application',
        'outline_consent',
        'reserved_matters',
      ],
      stagesAhead: [2, 3],
    },
    text: '{{hint:3}} takes longer to determine than the programme allows for it',
  },

  // The same mechanism seen from the scope side rather than the time side.
  // Separate candidate because it bears on a different objective, and the
  // proposal IS the objective: one candidate cannot propose two.
  {
    key: 'consent_condition_alters_scheme',
    type: RAID_TYPES.RISK,
    dimension: 'scope',
    when: {
      planningStatusIn: ['no_application', 'pre_application', 'outline_consent'],
      stagesAhead: [2, 3],
    },
    text: '{{hint:3}} is granted subject to a condition that changes the scheme the appraisal was built on',
  },

  // Procurement route. Under design and build the contractor carries the design
  // from a point in it, so the specification at novation is what binds.
  {
    key: 'db_design_responsibility_at_novation',
    type: RAID_TYPES.RISK,
    dimension: 'quality',
    when: {
      procurementRouteIn: ['design_build'],
      stagesAhead: [3, 4, 5],
    },
    text: "The employer's requirements are not specific enough at novation, so the delivered specification falls below the one appraised",
  },

  // Traditional route: the design is complete before the price, so the exposure
  // is the tender itself rather than the specification.
  {
    key: 'dbb_tender_above_appraisal',
    type: RAID_TYPES.RISK,
    dimension: 'cost',
    when: {
      procurementRouteIn: ['design_bid_build'],
      stagesAhead: [3, 4],
    },
    text: 'Tender returns come in above the cost the appraisal was built on',
  },

  // The programme condition: a recorded gate window shorter than the curated
  // span for that stage. The comparison is against the geography-expressed
  // template, so a future geography that moves the benchmark moves this too.
  {
    key: 'construction_window_under_typical',
    type: RAID_TYPES.RISK,
    dimension: 'time',
    when: {
      stageUnderTypical: 5,
      stagesAhead: [4, 5],
    },
    text: 'The construction window in the programme is shorter than the span this stage typically runs to',
  },

  {
    key: 'consent_window_under_typical',
    type: RAID_TYPES.RISK,
    dimension: 'time',
    when: {
      stageUnderTypical: 3,
      stagesAhead: [2, 3],
    },
    text: '{{hint:3}} is allowed a shorter window in the programme than the span this stage typically runs to',
  },

  // Over-constraint seen from the RAID side. Not a judgement: it states the
  // recorded classifications and what they leave, which is the framework's own
  // rule about slack.
  {
    key: 'no_slack_between_cost_and_time',
    type: RAID_TYPES.RISK,
    dimension: 'scope',
    when: {
      nonNegotiable: ['cost', 'time'],
      flexible: ['scope'],
    },
    text: 'With Cost and Time both non-negotiable, scope is the only objective left to absorb a movement',
  },

  // ── Assumptions ────────────────────────────────────────────────────────

  {
    key: 'assume_absorption_rate_holds',
    type: RAID_TYPES.ASSUMPTION,
    dimension: 'funding',
    when: { fundingStructureIn: ['off_plan_presales'] },
    text: 'The sales rate the drawdown schedule assumes holds through the build',
  },

  {
    key: 'assume_deposits_released_to_build',
    type: RAID_TYPES.ASSUMPTION,
    dimension: 'funding',
    when: { fundingStructureIn: ['off_plan_presales'] },
    text: 'Buyer deposits are available to fund construction on the schedule the programme assumes',
  },

  {
    key: 'assume_consent_as_designed',
    type: RAID_TYPES.ASSUMPTION,
    dimension: 'scope',
    when: {
      planningStatusIn: [
        'no_application',
        'pre_application',
        'outline_consent',
        'reserved_matters',
      ],
      stagesAhead: [2, 3],
    },
    text: '{{hint:3}} is granted for the scheme as designed, without a change to the mix or the quantum',
  },

  {
    key: 'assume_facility_drawn_on_schedule',
    type: RAID_TYPES.ASSUMPTION,
    dimension: 'funding',
    when: {
      fundingStructureIn: [
        'senior_debt',
        'development_finance',
        'bridging',
        'mezzanine',
      ],
    },
    text: 'The facility is drawn on the schedule the programme assumes, with each drawdown condition met when it falls due',
  },

  {
    key: 'assume_equity_available_when_called',
    type: RAID_TYPES.ASSUMPTION,
    dimension: 'funding',
    when: { fundingStructureIn: ['equity', 'jv', 'self_funded'] },
    text: 'The equity is available when it is called, without a further approval that is not yet recorded',
  },

  // ── Constraints ────────────────────────────────────────────────────────

  {
    key: 'constraint_presales_before_construction',
    type: RAID_TYPES.CONSTRAINT,
    dimension: 'funding',
    when: {
      fundingStructureIn: ['off_plan_presales'],
      stagesAhead: [3, 4, 5],
    },
    text: 'Construction cannot start ahead of the presales the funding structure requires',
  },

  {
    key: 'constraint_drawdown_conditions_bind',
    type: RAID_TYPES.CONSTRAINT,
    dimension: 'funding',
    when: { hasFundingMilestones: true },
    text: 'The recorded funding milestones bind the programme: a stage cannot run ahead of the drawdown that funds it',
  },

  {
    key: 'constraint_consent_before_commencement',
    type: RAID_TYPES.CONSTRAINT,
    dimension: 'time',
    when: {
      planningStatusIn: [
        'no_application',
        'pre_application',
        'outline_consent',
        'reserved_matters',
      ],
      stagesAhead: [2, 3, 4],
    },
    text: '{{hint:3}} must be in place before work can commence',
  },

  // ── Dependencies ───────────────────────────────────────────────────────

  {
    key: 'dependency_consent_authority',
    type: RAID_TYPES.DEPENDENCY,
    dimension: 'time',
    when: {
      planningStatusIn: [
        'no_application',
        'pre_application',
        'outline_consent',
        'reserved_matters',
      ],
      stagesAhead: [2, 3],
    },
    // The two dependency entries put the hint AFTER a colon rather than at the
    // head of a sentence. The stage 5 hint is a compound noun phrase in all
    // three expressions ("Party wall, building control and levy commencement
    // notices"), so any sentence built around it would have to agree with a
    // number the configuration owns and this file does not. The colon form
    // agrees with nothing, so a future geography can reword its hint freely.
    text: 'Determination by an authority outside the project team: {{hint:3}}',
  },

  {
    key: 'dependency_building_control',
    type: RAID_TYPES.DEPENDENCY,
    dimension: 'quality',
    when: { stagesAhead: [5, 6] },
    text: 'Approval by a body outside the project team: {{hint:5}}',
  },

  {
    key: 'dependency_buyer_finance',
    type: RAID_TYPES.DEPENDENCY,
    dimension: 'funding',
    when: {
      fundingStructureIn: ['off_plan_presales'],
      stagesAhead: [3, 4, 5, 6, 7],
    },
    text: 'Completion of each off-plan sale depends on the buyer securing their own finance',
  },
];

export const RAID_LIBRARY = deepFreeze(LIBRARY);

/**
 * WHAT THE STARTER LIBRARY COVERS, and where it is thin. Recorded here so the
 * domain side can author against it rather than rediscover it.
 *
 * COVERED, by condition:
 *   funding structure     off_plan_presales (five candidates), the debt family
 *                         (senior_debt, development_finance, bridging,
 *                         mezzanine), the equity family (equity, jv,
 *                         self_funded), and any project that recorded a funding
 *                         milestone at all.
 *   procurement route     design_build and design_bid_build.
 *   planning status       the four pre-consent states (no_application,
 *                         pre_application, outline_consent, reserved_matters).
 *   currency              NGN.
 *   classification        Cost non-negotiable under presales; Cost and Time both
 *                         non-negotiable with Scope flexible.
 *   programme             a recorded gate window under the curated span, at
 *                         Stage 3 and at Stage 5.
 *   geography             every candidate whose wording touches a jurisdictional
 *                         mechanism reads it from the geography configuration
 *                         through {{hint:3}} and {{hint:5}}, both of which
 *                         genuinely differ across all three expressions, so the
 *                         same scheme reads differently in Nigeria, in the
 *                         United Kingdom, and under the neutral base.
 *
 * THIN, and deliberately left for the domain side:
 *   - grant and other funding structures carry nothing. A grant's conditions and
 *     clawback are the interesting part and could not be written without
 *     asserting terms the inputs do not carry.
 *   - construction_management and management_contracting carry nothing. The
 *     package-interface exposure that distinguishes them is real, but wording it
 *     without knowing the package split would be an assertion.
 *   - the consented states (full_consent, approved) carry nothing. Discharge of
 *     conditions is the live exposure there and it needs the conditions.
 *   - refused carries nothing, deliberately: what follows a refusal is a
 *     decision, not a suggestion.
 *   - Quality carries two candidates against Funding's seven. The recorded facts
 *     that would key a quality candidate (the specification standard, the mix)
 *     are free text and JSONB, so a condition over them would be a guess at
 *     wording rather than a read of a value.
 *   - no candidate is keyed on unit count, gross internal area or storeys. They
 *     are recorded, but a threshold over them ("a scheme of more than N units
 *     carries X") is exactly the invented figure this note removes.
 *   - GBP and every other currency carry no currency candidate. Sterling cost
 *     exposure to imported materials is real, but it is not a function of the
 *     recorded reporting currency in the way the Naira case is.
 *   - the {{stage:N}} token is supported by the renderer and used by no
 *     candidate yet. It is the honest way to name a stage in future content,
 *     since the stage names are framework canon rather than library wording.
 *
 * ONE COUPLING TO KNOW ABOUT. The five candidates that build a sentence around
 * {{hint:3}} use a singular verb, because the stage 3 hint is a singular noun
 * phrase in all three expressions today ("State physical planning permit",
 * "Planning approval", "Development approval"). A future geography that sets a
 * plural stage 3 hint would need those five reworded. That is a content task,
 * not a code change, and the colon form used by the two dependency entries is
 * the pattern to reach for when it comes up.
 */
