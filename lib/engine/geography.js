/**
 * The geography expression (Note 10). PULSE's core is geography-agnostic; its
 * EXPRESSION is configurable. This module is where the expression lives.
 *
 * The bug this closes. The core was already geography-agnostic, but the
 * expression was hardcoded United Kingdom: placeholders offered NHBC and EPC
 * ratings, Programme hints named party wall notices, levy commencement notices
 * and the statutory determination period, and a template milestone was called
 * "Building Regulations completion certificate issued". A twelve-unit Lagos
 * off-plan scheme inherited every one of them, because they were baked into
 * component strings and the template constant rather than read from a
 * configuration. Fixing the individual strings was never the job. Moving them
 * behind a lookup keyed on the project's country, so the next geography is a
 * configuration entry rather than a code change, is the job.
 *
 * WHAT THIS MODULE IS. A lookup, and nothing else. It derives, it never
 * generates. Every value it returns is a frozen literal written here by hand:
 * no value is produced at runtime, no text is assembled from a rule, and nothing
 * is inferred from the project. Given the same country it returns the same
 * object, always.
 *
 * THE NEUTRAL BASE, AND WHY THE FALLBACK IS NEVER THE UNITED KINGDOM. There are
 * three expressions: a neutral base, a United Kingdom overlay, and a Nigeria
 * overlay. Each overlay is merged OVER the neutral base, so a key an overlay
 * does not set falls back to the neutral value, never to another geography's.
 * Any country that is not explicitly configured, including the enum's `other`,
 * a null country on a project set up before the field existed, and any future
 * value, resolves to the neutral base, whose text names no jurisdiction-specific
 * mechanism. The United Kingdom is one configured geography among the others and
 * is never the implicit default. That implicit default was the bug.
 *
 * WHAT THE CONFIGURATION CARRIES, and nothing else: the specification
 * placeholder (Step 4), the Programme helper hints (Step 7 and the Programme
 * module's reconcile-dates cards), the template milestone name overrides, the
 * date entry format, and the programme range benchmarks. Everything in it is
 * geography-dependent. Anything that is not, the display date format above all,
 * is deliberately NOT here: PULSE writes every date as "23 Jul 2026" everywhere
 * because that form is unambiguous in every jurisdiction (lib/engine/
 * dateFormat.js).
 *
 * WHERE A LOCAL MECHANISM IS NOT KNOWN, THE NEUTRAL FORM STANDS. A confidently
 * wrong statutory reference is worse than a neutral one, and it is the exact
 * failure this note is about. Where a geography's local equivalent could not be
 * established with confidence, the entry is left at the neutral wording and
 * noted below rather than guessed at. The VERIFY LOCALLY prompt that rides with
 * every location-sensitive hint is what makes that honest: PULSE is prompting
 * the developer to confirm a local requirement, never asserting a statutory
 * fact.
 *
 * Pure data plus one merge. No DB, no React, no network, no clock.
 */

import { DATE_INPUT_FORMATS } from './dateFormat.js';
import { PROGRAMME_TEMPLATE } from './programmeTemplate.js';

/**
 * The configured geographies. The two overlay keys are the `project_country`
 * enum values they express (migration 015: 'united_kingdom', 'nigeria',
 * 'other'), so the resolver joins straight onto the stored column with no
 * mapping table. NEUTRAL is not an enum value: it is the base every unconfigured
 * country resolves to, including 'other' and a null.
 */
export const GEOGRAPHY_KEYS = Object.freeze({
  NEUTRAL: 'neutral',
  UNITED_KINGDOM: 'united_kingdom',
  NIGERIA: 'nigeria',
});

// Deep freeze so a consumer genuinely cannot mutate the configuration it is
// handed. Mirrors the programme template's own guard.
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/**
 * The neutral base. Names no jurisdiction-specific mechanism anywhere: no
 * statutory instrument, no named authority, no warranty scheme. Every hint here
 * describes the THING that has to be confirmed, and leaves the local name of it
 * to the developer's own verification.
 */
const NEUTRAL = {
  key: GEOGRAPHY_KEYS.NEUTRAL,
  label: 'Not set',

  // Date entry format. Identical across both configured geographies today; it
  // sits in the configuration so a future geography that enters dates in a
  // different order is a configuration entry, not a code change.
  dateInputFormat: DATE_INPUT_FORMATS.DMY_SLASH,

  // Step 4, Scope and Site: the specification standard field. The examples name
  // the KIND of standard, not any jurisdiction's instrument.
  specificationPlaceholder: 'e.g. build standard, energy rating, fit-out level',

  // Step 4, Scope and Site: the planning field's label and its option wording.
  // The stored `planning_status` enum values are fixed and geography-agnostic
  // (migration 015 made them generic by design); only the wording follows the
  // jurisdiction, so the field reads naturally without the data forking. This
  // was already tailored per country, but by a conditional inside the step
  // rather than a configuration, so the next geography would still have been a
  // code change. The labels map is complete here and overlays override entries.
  planningStatusLabel: 'Planning or consent status',
  planningStatusLabels: {
    no_application: 'No application yet',
    pre_application: 'Pre-application',
    outline_consent: 'Outline consent',
    full_consent: 'Full consent',
    reserved_matters: 'Reserved matters',
    approved: 'Approved',
    refused: 'Refused',
    other: 'Other',
  },

  // The location-sensitive Programme hints, keyed by lifecycle stage. Each is
  // the { label, prompt } pair the template's `locationSensitive` holds: the
  // subject to confirm, and the instruction to confirm it. These reach the
  // developer in Step 7 under the stage's milestones, and again on the
  // Programme module's reconcile-dates cards behind a VERIFY LOCALLY chip.
  // They are FLAGS ONLY and carry no numeric value: PULSE prompts, it never
  // asserts a jurisdiction's statutory period.
  programmeHints: {
    3: [
      {
        label: 'Development approval',
        prompt: 'Confirm the local determination period',
      },
    ],
    4: [
      {
        label: 'Procurement timescales',
        prompt: 'Confirm which apply',
      },
    ],
    5: [
      {
        label: 'Pre-construction notices and building control',
        prompt: 'Confirm local requirements',
      },
    ],
    6: [
      {
        label: 'Completion certification and warranty sign-off',
        prompt: 'Confirm local requirements',
      },
    ],
  },

  // Template milestone name overrides, keyed by the milestone's stable key
  // (programmeTemplate.js). A key absent here keeps the template's own name.
  // Only names that are genuinely jurisdiction-specific belong here.
  milestoneNames: {
    // Stage 6. The template's own name, "Building Regulations completion
    // certificate issued", is a United Kingdom instrument; the neutral name
    // says what the certificate DOES.
    completion_certificate: 'Completion / occupancy certification issued',
  },

  // Programme range benchmarks: per-stage overrides of the curated durations the
  // reconcile flow's normal-ranges check works from, keyed by lifecycle stage.
  // An absent stage keeps the template's own curated figure. Empty here: the
  // programme template declares itself region-neutral and its durations are the
  // neutral baseline by definition, so the base overrides nothing. See the
  // BENCHMARKS note at the foot of this file.
  programmeBenchmarks: {},
};

/**
 * The United Kingdom overlay. Every entry is the wording PULSE shipped before
 * this note, preserved exactly: these were correct all along for a UK scheme,
 * and the defect was that they were the only expression rather than one of
 * several. Recording them here makes them attributable to the jurisdiction they
 * actually belong to.
 */
const UNITED_KINGDOM = {
  key: GEOGRAPHY_KEYS.UNITED_KINGDOM,
  label: 'United Kingdom',

  specificationPlaceholder: 'e.g. NHBC, EPC B, contemporary fit-out',

  planningStatusLabel: 'Planning status',
  planningStatusLabels: {
    outline_consent: 'Outline planning permission',
    full_consent: 'Full planning permission',
  },

  programmeHints: {
    3: [
      {
        label: 'Planning approval',
        prompt: 'Confirm the local statutory determination period',
      },
    ],
    4: [
      {
        label: 'Public procurement timescales',
        prompt: 'Confirm which apply',
      },
    ],
    5: [
      {
        label: 'Party wall, building control and levy commencement notices',
        prompt: 'Confirm local requirements',
      },
    ],
    6: [
      {
        label: 'Completion certification and warranty sign-off',
        prompt: 'Confirm local requirements',
      },
    ],
  },

  milestoneNames: {
    // The United Kingdom keeps the template's shipped name: Building
    // Regulations completion certification is the actual UK instrument.
    completion_certificate: 'Building Regulations completion certificate issued',
  },
};

/**
 * The Nigeria overlay. Written deliberately at the level the country
 * configuration can support: physical planning permits and building control in
 * Nigeria are STATE functions, so the hints name the state authority rather than
 * any one state's. Naming a single state (Lagos, say) in a configuration keyed
 * on the country would repeat this note's own error one scale down, handing an
 * Abuja scheme a Lagos mechanism. The state is what the developer confirms
 * locally, which is exactly what the VERIFY LOCALLY prompt is for.
 *
 * Two entries are deliberately left at the neutral base rather than guessed at,
 * and are listed in the LEFT NEUTRAL note at the foot of this file.
 */
const NIGERIA = {
  key: GEOGRAPHY_KEYS.NIGERIA,
  label: 'Nigeria',

  specificationPlaceholder:
    'e.g. National Building Code, finishing standard, contemporary fit-out',

  // Nigeria keeps the neutral option wording (a consent, not a permission) and
  // names the field for it. This is the wording the step already used.
  planningStatusLabel: 'Consent status',

  programmeHints: {
    3: [
      {
        label: 'State physical planning permit',
        prompt: 'Confirm the determination period with the state planning permit authority',
      },
    ],
    // Stage 4 is not overridden: it falls through to the neutral base. See the
    // LEFT NEUTRAL note. The UK's "public procurement timescales" is what the
    // test exposed as wrong for a private Lagos scheme, and the neutral
    // "procurement timescales, confirm which apply" is correct for both a
    // private and a publicly funded Nigerian scheme without asserting which.
    5: [
      {
        label: 'Building control approval and commencement notification',
        prompt: 'Confirm local requirements with the state building control agency',
      },
    ],
    6: [
      {
        label: 'Completion certification and warranty sign-off',
        prompt: 'Confirm local requirements with the state building control agency',
      },
    ],
  },

  // No milestone name override: Stage 6 falls through to the neutral
  // "Completion / occupancy certification issued". See the LEFT NEUTRAL note.
};

// The keyed maps in a configuration, merged entry by entry rather than replaced
// wholesale, so an overlay states only what genuinely differs and everything
// else holds the neutral value.
const MERGED_MAPS = [
  'programmeHints',
  'milestoneNames',
  'programmeBenchmarks',
  'planningStatusLabels',
];

// Merge one overlay over the neutral base. A key the overlay does not set falls
// back to the neutral value, NEVER to another geography's: that implicit
// fallback to the United Kingdom is the bug this whole module closes.
function overlay(config) {
  const merged = { ...NEUTRAL, ...config };
  for (const map of MERGED_MAPS) {
    merged[map] = { ...(NEUTRAL[map] ?? {}), ...(config[map] ?? {}) };
  }
  return merged;
}

// The three expressions, each overlay already merged over the neutral base and
// frozen, so resolution is a lookup rather than a merge performed per call.
const RESOLVED = deepFreeze({
  [GEOGRAPHY_KEYS.NEUTRAL]: { ...NEUTRAL },
  [GEOGRAPHY_KEYS.UNITED_KINGDOM]: overlay(UNITED_KINGDOM),
  [GEOGRAPHY_KEYS.NIGERIA]: overlay(NIGERIA),
});

/**
 * Resolve a project's country to its geography configuration.
 *
 * `country` is the stored `projects.country` value, a `project_country` enum
 * member or null. Anything not explicitly configured, 'other', null, undefined,
 * an unknown string, or a value of the wrong type, resolves to the neutral base.
 * It NEVER resolves to the United Kingdom.
 *
 * Returns a frozen configuration. The same country always returns the very same
 * object, so a caller may compare by identity.
 */
export function resolveGeography(country) {
  if (typeof country !== 'string') return RESOLVED[GEOGRAPHY_KEYS.NEUTRAL];
  const config = RESOLVED[country.trim()];
  // A configured overlay, or the neutral base. The neutral key itself is not a
  // stored country value, but resolving it to itself keeps the function total.
  return config ?? RESOLVED[GEOGRAPHY_KEYS.NEUTRAL];
}

/**
 * The programme template expressed for a project's geography: the curated
 * template with this geography's location-sensitive hints and milestone names
 * applied, and its benchmark overrides folded in.
 *
 * This is the single wiring point for the whole Programme surface. Every
 * derivation downstream, the advised dates, the milestone view, the reality
 * check and its normal-ranges benchmarks, the reconcile cards, and the assembly
 * that freezes into the locked baseline, already takes the template as an
 * argument. Handing them the geography-expressed template means the expression
 * reaches all of them with no change to a single engine signature, and no
 * derivation can accidentally read the neutral text while its neighbour reads
 * the local one.
 *
 * A milestone name override applies at RENDER and at LOCK, which means it
 * governs projects that have not yet locked a programme baseline. It does NOT
 * rewrite an existing project row: an already-locked baseline holds its
 * milestone names inside its frozen `programme_baselines.programme` snapshot,
 * and those names are that project's recorded data, not template output.
 *
 * Returns a new frozen template; never mutates PROGRAMME_TEMPLATE.
 */
export function geographyTemplate(country, template = PROGRAMME_TEMPLATE) {
  const geography = resolveGeography(country);
  return deepFreeze({
    ...template,
    // The template's own `region: 'neutral'` becomes the geography it is now
    // expressed for, so a snapshot records which expression produced it.
    region: geography.key,
    stages: (template.stages ?? []).map((stage) => {
      const hints = geography.programmeHints[stage.stage];
      const benchmark = geography.programmeBenchmarks[stage.stage];
      return {
        ...stage,
        ...(benchmark ?? {}),
        activities: (stage.activities ?? []).map((activity) => ({
          ...activity,
          milestones: (activity.milestones ?? []).map((milestone) => ({
            ...milestone,
            name: geography.milestoneNames[milestone.key] ?? milestone.name,
          })),
        })),
        // An unconfigured stage keeps the template's own flags, which are empty
        // for the five stages that carry none.
        locationSensitive: hints
          ? hints.map((h) => ({ label: h.label, prompt: h.prompt }))
          : (stage.locationSensitive ?? []),
      };
    }),
  });
}

/**
 * BENCHMARKS, what was found and what was set. Verified in the code before
 * changing anything:
 *
 * The reconcile flow's normal-ranges check (lib/engine/programmeRealityCheck.js)
 * holds NO numbers of its own. Every benchmark it compares against is read off
 * the template's own curated durations: a gate's implied stage span against
 * summedActivityBand(stage), built from the activities' `typicalWeeks`; a
 * headline milestone's implied offset against withinNormBand(offsetWeeks); and
 * the advised date it reports from the stage's `gateWeeks`. The band rule itself
 * (typical plus or minus fifty percent, minimum two weeks) is arithmetic and
 * carries no jurisdiction.
 *
 * So the benchmarks are the template's curated figures, and the template is a
 * single global constant declaring itself `region: 'neutral'` with
 * `basis: 'curated estimate'`. That is the real finding: no number in it is
 * labelled as any jurisdiction's, but a Nigeria project was checked against
 * exactly the same spans as a United Kingdom one, with no mechanism to differ.
 * The stage most exposed to that is Stage 3, Design and Planning Approvals,
 * whose gateWeeks of 30 and 'Planning and statutory approvals' typical of 12
 * weeks are the figures a jurisdiction's determination period would move most.
 *
 * The current figures, per stage: gateWeeks 12, 8, 6, 30, 12, 52, 6, 20.
 *
 * What is set for each geography: nothing, in all three. The mechanism is now
 * here (`programmeBenchmarks`, a per-stage override folded into the template by
 * geographyTemplate), and every geography currently resolves to the template's
 * own figures. A defensible Nigeria benchmark could not be established, and the
 * standing instruction is that a wrong number is worse than a neutral one, so
 * the neutral base stands rather than an invented figure. Filling in a local
 * benchmark is now a configuration entry here.
 *
 * LEFT NEUTRAL, for the domain side to fill in. Three entries could not be given
 * a confident Nigeria-specific form and deliberately hold the neutral wording:
 *   - Stage 4 procurement timescales. The United Kingdom's public procurement
 *     regime has a Nigerian counterpart in public contracting, but which
 *     timescales bind a privately funded scheme could not be established, and
 *     the test case is exactly a private scheme.
 *   - The Stage 6 milestone name. Nigeria falls through to
 *     "Completion / occupancy certification issued". A Certificate of Occupancy
 *     in Nigeria is a land-title instrument under the Land Use Act, not a
 *     building completion certificate, so naming the milestone after it would be
 *     precisely the confident-wrong reference this note exists to remove.
 *   - Every programme benchmark, as set out above.
 */
