/**
 * The Programme assembly engine (Programme module Phase 2.1). The pure logic
 * behind set-up step 4 in the Programme specification: it takes the developer's
 * hand-set programme dates with the reconcile resolutions applied, the two-level
 * template, and the project's objective index, and produces the fully-resolved
 * two-level programme: every gate dated where the chain can date it, every
 * milestone placed (dated where its rules allow, honestly undated where they do
 * not), each milestone carrying its served objective, its tier and its baked
 * criticality, each activity carrying its duration. This is the content that
 * becomes v1 at lock.
 *
 * It assembles; it does not store (that is 2.2) and it does not lock (that is
 * 2.3). Pure and deterministic: no DB, no React, no network, no system clock. It
 * reads the static template and the inputs passed in, and computes, so the same
 * inputs always give the same output and the whole module is unit-testable in
 * isolation. The agreed points, the resolution set, and the objective index are
 * passed in as plain input, never read from the database here; reading them out
 * of the locked Brief snapshot (v0) and the 1.2 flow state is the caller's job.
 *
 * HOW IT ASSEMBLES:
 *
 *  1. Apply the resolutions to get agreed dates. For each dated point, a gate or
 *     a headline milestone: if it is in the resolution set, use its agreed date
 *     (an accepted propose or force agreed the recommendation; a kept or verified
 *     decision agreed the developer's own date, both already resolved into
 *     `agreedDate` by reconcileModel.buildResolutions); if it is not in the set,
 *     use the developer's own date. within_norm points are not in the resolution
 *     set and keep their dates. An empty resolution set, the clean-skip case where
 *     nothing was flagged, means the developer's dates are used throughout.
 *
 *  2. Build the agreed skeleton from the agreed gate dates. After reconcile, an
 *     accepted recommendation may have moved a gate, which moves the start of the
 *     stage that follows it. The rolling chain is built from the agreed gate dates,
 *     not from the original gateWeeks-derived advised dates, by reusing
 *     deriveRollingGateDates with the agreed gate dates fed in as the chosen dates.
 *     Where a gate has no agreed or developer date it rolls from the previous
 *     applicable gate's effective date plus gateWeeks, exactly as the rolling chain
 *     does, so gateWeeks stays authoritative for any advised placement. Everything
 *     anchors to this agreed skeleton, the same anchor the Phase 1.1 reality check
 *     measured its spacing from.
 *
 *  3. Place every milestone, by its tier. The tier is the template's authority on
 *     who governs a point (MILESTONE_TIER): a headline milestone is the
 *     developer's, a drill-down milestone is the template's. Derivation never
 *     sets a date on a point the developer governs, and never on a critical one.
 *     - A headline milestone the developer dated takes its agreed date. That is
 *       authoritative even where it differs from a start-plus-offset position,
 *       because the developer set it (origin 'carried').
 *     - A headline milestone the developer left undated STAYS UNDATED (origin
 *       'carried', baselineDate null). It is user-governed: the engine never
 *       invents a date for it. It remains in v1 by name, is shown undated at
 *       review and lock, and the tracking surface reads it as an undated point.
 *     - A drill-down milestone whose baked criticality is standard takes a
 *       baseline date derived from its offsetWeeks on the agreed skeleton, placed
 *       at the agreed stage start plus the absolute offset (origin 'added'). The
 *       offset is not scaled to fit a moved gate. Where an offset lands past its
 *       agreed gate it is left as it falls, an honest first-draft position the
 *       review-and-lock reconciliation names against the completion gate.
 *     - A drill-down milestone whose baked criticality is critical STAYS UNDATED
 *       (origin 'added', baselineDate null). A point serving a protected
 *       objective never takes a fabricated date: a derived date there would feed
 *       the protected ladder a commitment no one made.
 *
 *  4. Bake criticality. Each milestone's criticality is classified from its
 *     `serves` against the project's objective index, through the existing
 *     criticality kernel (classifyByType over buildObjectiveIndex's byType), and
 *     baked into the assembled object so the tracking surface reads it without
 *     re-deriving. The rule is the kernel's, never reinvented here.
 *
 * THE HELD GATE DIVERGENCE, carried forward not re-opened. The Foundation held
 * gateWeeks authoritative for gate placement and exposed stageActivityWeeks,
 * flagging that the activity sums diverge from gateWeeks on seven of the eight
 * stages. The reconcile already happened in Phase 1.2; this engine consumes its
 * result. It keeps gateWeeks authoritative for any advised placement, uses the
 * agreed dates for the skeleton, and does not move gateWeeks, the activity
 * typicals, the template, or the Brief. Each activity carries its duration; it is
 * not given a derived start and end here, because the activity-sum-vs-gate
 * reconciliation is the deferred durations pass, not this step. The engine does
 * not re-run the reality check and does not re-open the reconcile.
 *
 * THE EIGHT EMPTY ACTIVITIES, expected and not a bug. Eight of the seventeen
 * activities currently carry no milestones; their drill-down milestones are
 * deferred content. The engine assembles an activity with zero milestones cleanly:
 * it contributes its duration, and a dated gate only where it closes a stage, and
 * no milestone events. No milestones are invented to fill them. When the drill-down
 * milestones are added to the template later, the engine places them automatically
 * through the same offset-derivation path, with no further change.
 *
 * Weeks are whole seven-day spans measured in UTC epoch milliseconds, the same
 * convention as programmeSchedule.js, so nothing drifts across a daylight-saving
 * boundary.
 */

import { deriveRollingGateDates } from './programmeSchedule.js';
import { MILESTONE_TIER } from './programmeTemplate.js';
import { buildObjectiveIndex, classifyByType, CRITICALITY } from './criticality.js';

// The provenance tag on an assembled point, the carry-versus-add distinction the
// review-and-lock screen (2.3) reads: a point the Brief carried from the
// developer's hand-set dates, versus one the engine added when it expanded the
// programme at set-up. A gate is always carried (it is a Brief point). A milestone
// the developer dated is carried; a drill-down milestone the engine placed by its
// offset is added. Frozen so a caller cannot mutate the vocabulary.
export const ITEM_ORIGIN = Object.freeze({
  CARRIED: 'carried',
  ADDED: 'added',
});

// One week in milliseconds. Weeks are whole seven-day spans, so adding them in
// epoch milliseconds is exact and timezone-neutral.
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Soft parse to epoch milliseconds, or null. An absent, empty or unparseable
// value (an undated point, a blank input) is simply "no date". Accepts a Date, an
// ISO date string (a plain YYYY-MM-DD is parsed as UTC), or epoch milliseconds.
// Mirrors programmeSchedule.softEpoch and programmeRealityCheck.softEpoch.
function softEpoch(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    const epoch = value.getTime();
    return Number.isNaN(epoch) ? null : epoch;
  }
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const epoch = Date.parse(trimmed);
    return Number.isNaN(epoch) ? null : epoch;
  }
  return null;
}

// Add a whole number of weeks to an epoch, returning a Date.
function addWeeks(epochMs, weeks) {
  return new Date(epochMs + weeks * MS_PER_WEEK);
}

// The stable gate key for a stage, the same convention the reality check and the
// reconcile resolutions use (`gate_<stage>`), so a resolution keyed by it joins
// straight to the stage's gate here.
function gateKey(stage) {
  return `gate_${stage}`;
}

// Normalise the developer's programme choices into a stage-keyed lookup. Accepts
// the choices object ({ stages: [...] }, as loadProgrammeChoices returns) or a
// plain per-stage array; each entry carries { stage, target_date, target_na,
// milestones }. Mirrors the lookups in the sibling engines.
function choiceLookup(choices) {
  const list = Array.isArray(choices) ? choices : (choices?.stages ?? []);
  const lookup = new Map();
  for (const choice of list) {
    if (choice == null || choice.stage == null) continue;
    lookup.set(choice.stage, choice);
  }
  return lookup;
}

// Normalise the resolution set into a lookup keyed by the item's key (gate keys
// are `gate_<stage>`, milestone keys are the template's stable keys, and the two
// never collide, so a key is unique across the set). Accepts the array
// reconcileModel.buildResolutions emits, each entry carrying { key, kind, stage,
// tier, developerDate, recommendedDate, agreedDate, decision, note }. Anything
// without a key is skipped.
function resolutionLookup(resolutions) {
  const lookup = new Map();
  for (const res of resolutions ?? []) {
    if (res == null || res.key == null) continue;
    lookup.set(res.key, res);
  }
  return lookup;
}

// Resolve the project's objective index to the byType map the criticality kernel
// classifies milestones against. Accepts either the project's objective rows
// ({ id, objective_type, classification }), built into an index here exactly as
// the sibling milestone view does, or an already-built index ({ byId, byType })
// passed straight in. Either way the kernel's classifyByType reads `byType`.
function resolveByType(objectiveIndex) {
  if (
    objectiveIndex &&
    !Array.isArray(objectiveIndex) &&
    (objectiveIndex.byType || objectiveIndex.byId)
  ) {
    return objectiveIndex.byType ?? {};
  }
  return buildObjectiveIndex(objectiveIndex ?? []).byType;
}

// A fresh copy of an activity's within-norm band, so the assembled snapshot holds
// its own plain { min, max } rather than a reference into the frozen template.
function cloneBand(band) {
  return { min: band?.min ?? null, max: band?.max ?? null };
}

/**
 * Place one template milestone on the agreed skeleton, by its tier.
 *
 * A developer-dated milestone (in the resolution set, or carrying a developer
 * date in the choices) takes its agreed date and is tagged carried: the
 * resolution's agreed date where it was flagged and resolved, otherwise the
 * developer's own date (which covers a within_norm headline milestone, dated but
 * never flagged).
 *
 * With no date, the tier decides, never a guess. A headline milestone is
 * user-governed, so it stays undated and carried: derivation never sets a date
 * on a point the developer governs. A drill-down milestone is the template's
 * (origin added): it takes the stage start plus its curated offset when its
 * baked criticality is standard, and stays undated when critical, because a
 * fabricated date must never drive a protected objective's monitoring. An
 * untagged milestone (a legacy or foreign one with no tier) is treated as
 * headline, the same reading stageMilestones holds to.
 */
function placeMilestone(milestone, stageStartEpoch, choice, byType, resolutionByKey) {
  const res = resolutionByKey.get(milestone.key);
  const resolvedEpoch = res ? softEpoch(res.agreedDate) : null;
  const devEpoch = softEpoch((choice.milestones ?? {})[milestone.key]?.target_date);
  const criticality = classifyByType(milestone.serves, byType);
  const tier =
    milestone.tier === MILESTONE_TIER.DRILLDOWN
      ? MILESTONE_TIER.DRILLDOWN
      : MILESTONE_TIER.HEADLINE;

  let baselineDate = null;
  let origin;
  if (resolvedEpoch != null) {
    baselineDate = new Date(resolvedEpoch);
    origin = ITEM_ORIGIN.CARRIED;
  } else if (devEpoch != null) {
    baselineDate = new Date(devEpoch);
    origin = ITEM_ORIGIN.CARRIED;
  } else if (tier === MILESTONE_TIER.DRILLDOWN) {
    // The template's own point. Dated by the absolute offset from the agreed
    // stage start (never scaled to fit a moved gate) only while standard; a
    // critical drill-down stays undated, so no derived date ever reaches a
    // point that serves a protected objective.
    origin = ITEM_ORIGIN.ADDED;
    if (criticality !== CRITICALITY.CRITICAL) {
      baselineDate = addWeeks(stageStartEpoch, milestone.offsetWeeks);
    }
  } else {
    // User-governed and undated: it stays undated and is named at lock.
    origin = ITEM_ORIGIN.CARRIED;
  }

  return {
    key: milestone.key,
    name: milestone.name,
    serves: milestone.serves,
    criticality,
    tier,
    offsetWeeks: milestone.offsetWeeks,
    baselineDate,
    origin,
  };
}

// Assemble one activity: its stable identity and duration, plus its milestones
// placed on the agreed skeleton. An activity with no milestones assembles cleanly
// to an empty list. When the stage is not applicable no stage start is held, so
// the activity contributes its duration and structure but no dated milestones.
function buildActivity(activityDef, stageStartEpoch, choice, byType, resolutionByKey) {
  const milestonesDef = activityDef.milestones ?? [];
  const milestones =
    stageStartEpoch == null
      ? []
      : milestonesDef.map((m) =>
          placeMilestone(m, stageStartEpoch, choice, byType, resolutionByKey)
        );
  return {
    key: activityDef.key,
    name: activityDef.name,
    durationWeeks: activityDef.typicalWeeks,
    withinNormWeeks: cloneBand(activityDef.withinNormWeeks),
    milestones,
  };
}

/**
 * Assemble the fully-resolved two-level programme.
 *
 * projectStart  a Date, an ISO date string, or epoch milliseconds. Required: the
 *               assembly runs once the Brief has locked, so a start is held.
 * template      the programme template (PROGRAMME_TEMPLATE), or any object with
 *               the same two-level { version, stages: [{ stage, name, gateWeeks,
 *               activities, locationSensitive }] } shape.
 * choices       the developer's hand-set programme choices ({ stages: [...] }) or
 *               a per-stage array, each entry { stage, target_date, target_na,
 *               milestones: { [key]: { target_date, note } } }. The same shape the
 *               Phase 1.1 reality check consumed.
 * resolutions   the resolution set from reconcileModel.buildResolutions: an array
 *               of { key, kind, stage, tier, developerDate, recommendedDate,
 *               agreedDate, decision, note }. Empty (or absent) for the clean-skip
 *               case where nothing was flagged.
 * objectiveIndex  the project's objective index for the criticality join: the
 *               objective rows ({ id, objective_type, classification }) or an
 *               already-built index ({ byId, byType }).
 *
 * Returns the fully-resolved programme, nothing left to re-derive (an undated
 * point is honestly undated, never a deferred computation), the snapshot-ready
 * content 2.2 freezes as v1:
 *   {
 *     version,            echoed from the template for traceability
 *     projectStart,       Date, the normalised start
 *     stages: [
 *       {
 *         stage, name,
 *         applicable,        false for a stage marked not applicable
 *         stageStart,        Date, or null when not applicable
 *         activities: [
 *           {
 *             key, name,
 *             durationWeeks,        the activity's typical duration in weeks
 *             withinNormWeeks: { min, max },
 *             milestones: [
 *               {
 *                 key, name, serves,
 *                 criticality,      baked: 'critical' | 'standard'
 *                 tier,             'headline' | 'drilldown', the template's
 *                                   authority on who governs the point
 *                 offsetWeeks,      the curated offset, for provenance
 *                 baselineDate,     Date, or null for an undated point (an
 *                                   undated headline, or a critical drill-down)
 *                 origin,           'carried' | 'added'
 *               }
 *             ]
 *           }
 *         ],
 *         gate: {
 *           key,                    `gate_<stage>`
 *           name,                   the stage name
 *           baselineDate,           Date, or null when not applicable
 *           origin,                 'carried'
 *           closesActivityKey,      the final activity's key, or null
 *         },
 *         locationSensitive: [ { label, prompt } ]   passed through, flags only
 *       }
 *     ]
 *   }
 */
export function assembleProgramme(
  projectStart,
  template,
  choices,
  resolutions,
  objectiveIndex
) {
  const startEpoch = softEpoch(projectStart);
  if (startEpoch == null) {
    throw new Error('assembleProgramme: a project start date is required');
  }

  const choiceByStage = choiceLookup(choices);
  const resolutionByKey = resolutionLookup(resolutions);
  const byType = resolveByType(objectiveIndex);
  const stageDefs = template?.stages ?? [];

  // The agreed gate dates fed into the rolling chain as chosen dates: the
  // resolution's agreed date where the gate was flagged and resolved, otherwise
  // the developer's own date (an undated gate is left blank so the chain rolls it
  // from gateWeeks). The developer's N/A flag carries through unchanged.
  const agreedGateChoices = stageDefs.map((stageDef) => {
    const choice = choiceByStage.get(stageDef.stage) ?? {};
    const res = resolutionByKey.get(gateKey(stageDef.stage));
    const resolvedEpoch = res ? softEpoch(res.agreedDate) : null;
    return {
      stage: stageDef.stage,
      target_date:
        resolvedEpoch != null ? new Date(resolvedEpoch) : (choice.target_date ?? null),
      target_na: choice.target_na === true,
    };
  });

  // The agreed skeleton. deriveRollingGateDates rolls each gate from the previous
  // applicable gate's effective date (the agreed date where set, otherwise the
  // rolled gateWeeks date), so an accepted recommendation that moved a gate moves
  // the start of every stage after it, exactly as set-up requires.
  const rolling = deriveRollingGateDates(startEpoch, template, agreedGateChoices);

  // The agreed stage start and the agreed (dated) gate, per applicable stage. The
  // stage start is the previous applicable gate's effective date, the project
  // start for the first applicable stage; the gate is this stage's own effective
  // date. This mirrors the anchor the Phase 1.1 reality check measured from.
  const startByStage = new Map();
  const gateDateByStage = new Map();
  let prevEffectiveEpoch = null;
  for (const rollingStage of rolling.stages) {
    if (!rollingStage.applicable) continue;
    startByStage.set(
      rollingStage.stage,
      prevEffectiveEpoch == null ? startEpoch : prevEffectiveEpoch
    );
    const effectiveEpoch = rollingStage.effectiveDate
      ? rollingStage.effectiveDate.getTime()
      : prevEffectiveEpoch;
    gateDateByStage.set(rollingStage.stage, effectiveEpoch);
    prevEffectiveEpoch = effectiveEpoch;
  }

  const stages = stageDefs.map((stageDef) => {
    const choice = choiceByStage.get(stageDef.stage) ?? {};
    const applicable = choice.target_na !== true;
    const activitiesDef = stageDef.activities ?? [];
    const closesActivityKey = activitiesDef.length
      ? activitiesDef[activitiesDef.length - 1].key
      : null;

    if (!applicable) {
      // A not-applicable stage is skipped from the dated programme: it raises no
      // dated gate and no milestone events. Its activities keep their structure
      // and duration so the two-level shape stays uniform across all stages.
      return {
        stage: stageDef.stage,
        name: stageDef.name,
        applicable: false,
        stageStart: null,
        activities: activitiesDef.map((a) =>
          buildActivity(a, null, choice, byType, resolutionByKey)
        ),
        gate: {
          key: gateKey(stageDef.stage),
          name: stageDef.name,
          baselineDate: null,
          origin: ITEM_ORIGIN.CARRIED,
          closesActivityKey,
        },
        locationSensitive: [],
      };
    }

    const stageStartEpoch = startByStage.get(stageDef.stage) ?? startEpoch;
    const gateEpoch = gateDateByStage.get(stageDef.stage) ?? null;

    return {
      stage: stageDef.stage,
      name: stageDef.name,
      applicable: true,
      stageStart: new Date(stageStartEpoch),
      activities: activitiesDef.map((a) =>
        buildActivity(a, stageStartEpoch, choice, byType, resolutionByKey)
      ),
      gate: {
        key: gateKey(stageDef.stage),
        name: stageDef.name,
        baselineDate: gateEpoch == null ? null : new Date(gateEpoch),
        origin: ITEM_ORIGIN.CARRIED,
        closesActivityKey,
      },
      locationSensitive: (stageDef.locationSensitive ?? []).map((point) => ({
        label: point.label,
        prompt: point.prompt,
      })),
    };
  });

  return {
    version: template?.version ?? null,
    projectStart: new Date(startEpoch),
    stages,
  };
}
