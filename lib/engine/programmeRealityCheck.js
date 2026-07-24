/**
 * The Programme reality-check engine (Programme module Phase 1.1). The pure logic
 * behind set-up steps 2 and 3 in the Programme specification: it takes the
 * developer's hand-set programme dates plus the two-level template and classifies
 * each dated point into a reconcile tier, with a recommended date where it
 * diverges and a short reason. It classifies only. It enforces nothing, persists
 * nothing, and changes nothing in the Brief. The reconcile-dates screen (Phase
 * 1.2) is what blocks on force, offers accept or keep, and records a kept
 * divergence as a risk. This module just labels.
 *
 * Pure and deterministic: no DB, no React, no network, no system clock. It reads
 * the static template and the dates passed in, and computes. The same inputs
 * always give the same output, and the whole module is unit-testable in
 * isolation. The developer's dates are passed in as plain input, never read from
 * the database here; reading them out of the locked Brief snapshot (v0) is the
 * 1.2 screen's job.
 *
 * The dated input is the developer's programme choices, the very shape
 * loadProgrammeChoices returns and deriveRollingGateDates already consumes:
 *   { stages: [ { stage, target_date, target_na,
 *                 milestones: { [milestoneKey]: { target_date, note } } } ] }
 * The chosen gate date is target_date; a gate marked not applicable is target_na;
 * the chosen headline-milestone dates ride in the milestones map, keyed by the
 * template milestone's stable key. A plain per-stage array is accepted too. Only
 * points the developer actually dated are checked; an undated point raises no
 * prompt, exactly as set-up checks the dates the developer set by hand.
 *
 * THE TWO CHECKS, both against the template:
 *
 *  1. Each dated point against its advised date and any confirmed hard floor.
 *     The advised date is the gateWeeks-based date from deriveAdvisedDates, so
 *     gateWeeks stays authoritative for advised gate placement, exactly as the
 *     Foundation and the Brief hold it. The advised date is reported for the
 *     screen; the tier itself is driven by the spacing check below plus the
 *     hard-floor and location-sensitive conditions, because what matters for a
 *     credible programme is the duration the dates imply, not how far the whole
 *     programme has shifted in absolute time.
 *
 *  2. The spacing between points, read as the implied duration of the activities
 *     those points bound, checked against the activity's generous withinNormBand:
 *       - A gate bounds its whole stage. The implied stage span is this gate's
 *         developer date minus the stage's WINDOW START (for a sequential stage
 *         the previous applicable gate's effective date, the developer's date
 *         where set, otherwise its advised date, and the project start for the
 *         first applicable stage). It is checked
 *         against the stage's summed activity band, the sum of its activities'
 *         within-norm minima and maxima. This is the granularity the developer's
 *         gate dates allow: a single activity is not individually isolated by a
 *         developer date at this step, so the stage's activities are bounded and
 *         checked together. Their drill-down dating is Phase 2.
 *       - A headline milestone bounds its position within the stage. The implied
 *         offset is this milestone's developer date minus the stage start,
 *         checked against withinNormBand(offsetWeeks), the same generous-band
 *         rule applied to the milestone's curated offset. A milestone's template
 *         offset sits inside its home activity and is deliberately not reconciled
 *         to the activity durations at this step (see programmeTemplate.js, the
 *         gate timing note), so the milestone is checked on its own offset, not
 *         used to subdivide the stage's activities. The generous band absorbs the
 *         normal slop; only a real divergence surfaces.
 *
 *     The band is generous by design (typical plus or minus fifty percent,
 *     minimum two weeks, the same withinNormBand the template froze), so
 *     reasonable dates pass silently and only real divergence is surfaced.
 *
 * THE HELD GATE DIVERGENCE, surfaced not resolved. The Foundation held gateWeeks
 * authoritative for gate placement and exposed stageActivityWeeks, flagging that
 * the activity sums diverge from gateWeeks on seven of the eight stages, the
 * activity typicals running short. This engine is where that divergence could
 * reach the developer, and the rule is: keep gateWeeks authoritative for the
 * advised date, and use the generous summed band for the implied-stage-duration
 * check. On every stage the gateWeeks span sits inside that summed band, so a
 * developer who accepts the advised, gateWeeks-based dates reads within_norm
 * throughout; the generous band absorbs the divergence, which is intended. A
 * developer date that pushes a stage's implied duration outside the band is what
 * surfaces a propose. The engine never resolves the divergence: it does not move
 * gateWeeks, re-tune the activity typicals, or touch the Brief. The per-project
 * resolution is the developer's accept-or-keep in the 1.2 screen.
 *
 * THE FOUR TIERS:
 *   - within_norm. The implied duration sits inside the generous band, no
 *     confirmed floor is breached, and there is no unconfirmed location-sensitive
 *     point. Silent, no prompt.
 *   - propose. The implied duration diverges beyond the generous band. The engine
 *     returns a recommended date, the date that brings the duration back to its
 *     typical (the stage's summed activity typicals for a gate, the milestone's
 *     curated offset for a milestone), and a short reason. It does not block.
 *   - force. A confirmed local hard-floor value applies to the point and is
 *     breached. Force is only assigned where a confirmed local value exists and
 *     is breached; the engine labels it force and the 1.2 screen is what blocks.
 *   - flag_verify. A location-sensitive point with no confirmed local value
 *     supplied. This is the region-neutral degradation of force: verify this
 *     against your jurisdiction, a soft prompt, not a block. Because the template
 *     is region-neutral and carries no confirmed local statutory values, a
 *     location-sensitive point resolves to flag_verify in this step, not to
 *     force, unless the caller supplies a confirmed local value through
 *     options.localFloors.
 *
 * STAGE STATES AND THE BENCHMARK (note 6). Which start a stage's span is
 * measured from, and whether the span has an upper norm at all, is the
 * stage-state model's answer (lib/engine/stageStates.js), read here through the
 * window start the rolling chain returns:
 *   - A sequential stage is unchanged: it starts at the previous applicable
 *     gate and is checked against the full summed band, minimum and maximum.
 *   - A concurrent stage starts at its declared window anchor, so a stage 7 that
 *     runs alongside construction is measured from sales launch, not from the
 *     completion gate. Measured from the completion gate its implied duration
 *     collapsed towards zero and the engine proposed moving disposal out past
 *     practical completion, which is the wrong recommendation for an off-plan
 *     scheme. Its band also loses its upper bound: overlapping the rest of the
 *     programme is the point of a concurrent stage, so a long span is not a
 *     divergence. Only a span too short to contain the stage's own work is,
 *     so the minimum still bites.
 *   - A complete stage raises no items. Its dates are what happened, not a
 *     plan, and there is nothing to reconcile in history.
 *
 * Location sensitivity is carried on the stage and attaches to that stage's gate,
 * the stage's go or no-go decision point, where a statutory determination period
 * bites. A confirmed local value is supplied per stage through
 * options.localFloors as { [stage]: { floorWeeks } }, a confirmed minimum number
 * of weeks from the stage start to the gate. The value must be a finite,
 * non-negative number to count as confirmed (zero is valid: the requirement was
 * checked and carries no minimum); a malformed value is treated as not supplied.
 * When supplied and breached the gate is force; when supplied and met the
 * location-sensitive prompt is satisfied and the gate falls through to the
 * spacing check; when not supplied a dated location-sensitive gate is flag_verify.
 *
 * Weeks are whole seven-day spans measured in UTC epoch milliseconds, the same
 * convention as programmeSchedule.js, so nothing drifts across a daylight-saving
 * boundary. Implied durations are exact (they may be fractional weeks when a
 * developer dates a point off a whole-week boundary); the comparison against the
 * whole-week band is inclusive at both edges.
 */

import {
  deriveAdvisedDates,
  deriveRollingGateDates,
} from './programmeSchedule.js';
import {
  stageMilestones,
  stageActivityWeeks,
  summedActivityBand,
  withinNormBand,
} from './programmeTemplate.js';
import { isComplete, isConcurrent, stageStateFor, stageStateLookup } from './stageStates.js';

// The reconcile tiers, the only labels the engine assigns. Frozen so a caller
// cannot mutate the vocabulary.
export const RECONCILE_TIERS = Object.freeze({
  WITHIN_NORM: 'within_norm',
  PROPOSE: 'propose',
  FORCE: 'force',
  FLAG_VERIFY: 'flag_verify',
});

// The two kinds of dated point the engine checks. A gate is a stage's go or
// no-go boundary; a milestone is a headline milestone sitting under an activity.
export const RECONCILE_ITEM_KINDS = Object.freeze({
  GATE: 'gate',
  MILESTONE: 'milestone',
});

// What the implied weeks measure, so the screen can label the figure correctly.
export const IMPLIED_BASES = Object.freeze({
  STAGE_SPAN: 'stage_span',
  STAGE_OFFSET: 'stage_offset',
});

// One week in milliseconds. Weeks are whole seven-day spans, so measuring them in
// epoch milliseconds is exact and timezone-neutral.
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Soft parse to epoch milliseconds, or null. An absent, empty or unparseable
// value (an undated point, a blank input) is simply "no date", so it is not
// checked. Accepts a Date, an ISO date string (a plain YYYY-MM-DD is parsed as
// UTC), or epoch milliseconds. Mirrors programmeSchedule.softEpoch.
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

// The whole-week distance between two epochs, in weeks. May be fractional when a
// date sits off a whole-week boundary.
function weeksBetween(fromEpoch, toEpochMs) {
  return (toEpochMs - fromEpoch) / MS_PER_WEEK;
}

// Inclusive band membership: min <= weeks <= max, both edges counted as inside,
// so a duration exactly on the generous band edge reads within_norm. A null max
// is an open upper bound (a concurrent stage, whose span legitimately absorbs
// the stages it overlaps), so only the minimum bites.
function inBand(weeks, band) {
  return weeks >= band.min && (band.max == null || weeks <= band.max);
}

// Open a band's upper bound, keeping its minimum. The one rule a concurrent
// stage's checks share: a stage that runs alongside the rest of the programme
// stretches its own internal spans, so a long one is not a divergence. Only a
// span too short to contain the work still is, which is what the minimum holds.
function openTop(band) {
  return { min: band.min, max: null };
}

// The band a stage's implied span is checked against, from its state.
function spanBandFor(stageDef, stageState) {
  const band = summedActivityBand(stageDef);
  return isConcurrent(stageState) ? openTop(band) : band;
}

// The band a milestone's implied offset is checked against, from its stage's
// state. Same rule as the span above: in a concurrent stage the offset is
// measured across a window that spans the programme, so its top opens.
function offsetBandFor(milestone, stageState) {
  const band = withinNormBand(milestone.offsetWeeks);
  return isConcurrent(stageState) ? openTop(band) : band;
}

// The reason a gate's implied stage span sits outside its band. An open-topped
// band can only be breached from below, and says so in the developer's terms.
function spanReason(weeks, band, side) {
  if (band.max == null) {
    return (
      `Implied stage duration of ${outsideWeeks(weeks, side)} weeks is below ` +
      `the ${band.min} week minimum for this stage's activities, which run ` +
      `alongside the rest of the programme.`
    );
  }
  return (
    `Implied stage duration of ${outsideWeeks(weeks, side)} weeks is ` +
    `${side} the ${band.min} to ${band.max} week norm for this stage's activities.`
  );
}

// The reason a milestone's implied offset sits outside its band, the same shape
// as the span reason above.
function offsetReason(weeks, band, side) {
  if (band.max == null) {
    return (
      `Implied ${outsideWeeks(weeks, side)} weeks from the stage start is ` +
      `below the ${band.min} week minimum for this milestone, in a stage that ` +
      `runs alongside the rest of the programme.`
    );
  }
  return (
    `Implied ${outsideWeeks(weeks, side)} weeks from the stage start is ` +
    `${side} the ${band.min} to ${band.max} week norm for this milestone.`
  );
}

// The implied weeks rounded to a whole number for a reason string, rounded in the
// direction that keeps it honestly outside the band: down when below the minimum,
// up when above the maximum. So a fractional span like 30.4 weeks above a band
// whose max is 30 reads "31 weeks", never the self-contradictory "30 weeks is
// above the 30 week norm". A whole-week span is unchanged.
function outsideWeeks(weeks, side) {
  return side === 'below' ? Math.floor(weeks) : Math.ceil(weeks);
}

// The summed within-norm band for a stage (sum of the activities' within-norm
// minima and maxima), the generous band a gate's implied stage span is checked
// against. It lives in programmeTemplate.js beside stageActivityWeeks so the
// stage-band derivations sit in one place; re-exported here for callers of this
// engine.
export { summedActivityBand };

// Normalise the developer's programme choices into a stage-keyed lookup. Accepts
// the choices object ({ stages: [...] }, as loadProgrammeChoices returns) or a
// plain per-stage array; each entry carries { stage, target_date, target_na,
// milestones }. Mirrors the lookups in programmeSchedule and programmeMilestones.
function choiceLookup(choices) {
  const list = Array.isArray(choices) ? choices : (choices?.stages ?? []);
  const lookup = new Map();
  for (const choice of list) {
    if (choice == null || choice.stage == null) continue;
    lookup.set(choice.stage, choice);
  }
  return lookup;
}

/**
 * Classify the developer's hand-set programme dates against the two-level
 * template. Returns a deterministic result the 1.2 reconcile screen can render
 * directly.
 *
 * projectStart  a Date, an ISO date string, or epoch milliseconds. Required: the
 *               reality check runs once the Brief has locked, so a start is held.
 * template      the programme template (PROGRAMME_TEMPLATE), or any object with
 *               the same two-level shape.
 * choices       the developer's programme choices ({ stages: [...] }) or a
 *               per-stage array, each entry { stage, target_date, target_na,
 *               milestones: { [key]: { target_date } } }.
 * options       optional. options.localFloors is the confirmed local hard floors,
 *               keyed by stage: { [stage]: { floorWeeks } }, a confirmed minimum
 *               number of weeks from the stage start to the gate.
 *               options.stageStates is the stage states (deriveStageStates'
 *               output, or a per-stage array). Omitted, every stage reads as
 *               sequential and the whole check is unchanged.
 *
 * Returns:
 *   {
 *     version,            echoed from the template for traceability
 *     projectStart,       Date, the normalised start
 *     anyFlagged,         true if any checked item is not within_norm, so the
 *                         1.2 screen knows whether to render the reconcile step or
 *                         skip it entirely
 *     counts,             { within_norm, propose, force, flag_verify } tallies
 *     items: [            one per dated point, gates and milestones, in stage then
 *                         milestone-before-gate order
 *       {
 *         stage,                0 to 7
 *         kind,                 'gate' | 'milestone'
 *         key,                  gate: `gate_<stage>`; milestone: its stable key
 *         name,                 the stage name (gate) or milestone name
 *         developerDate,        Date, the date the developer set
 *         advisedDate,          Date or null, the gateWeeks-based advised date
 *         implied: {            the implied-duration check
 *           basis,              'stage_span' (gate) | 'stage_offset' (milestone)
 *           weeks,              the implied weeks (may be fractional)
 *           band: { min, max }, the generous within-norm band
 *           withinBand,         boolean
 *         },
 *         tier,                 'within_norm' | 'propose' | 'force' | 'flag_verify'
 *         recommendedDate,      Date or null; set when propose or force
 *         locationSensitive,    boolean; true for a location-sensitive gate
 *         reason,               short string; '' when within_norm
 *       }
 *     ]
 *   }
 */
export function deriveRealityCheck(projectStart, template, choices, options) {
  const startEpoch = softEpoch(projectStart);
  if (startEpoch == null) {
    throw new Error('deriveRealityCheck: a project start date is required');
  }

  const choiceByStage = choiceLookup(choices);
  const localFloors = options?.localFloors ?? {};
  const stageStates = options?.stageStates;
  const stateByStage = stageStateLookup(stageStates);
  const stageDefs = template?.stages ?? [];

  // The N/A stages the developer marked, so the advised chain skips them exactly
  // as the developer's programme does.
  const naStages = [];
  for (const stageDef of stageDefs) {
    if (choiceByStage.get(stageDef.stage)?.target_na === true) {
      naStages.push(stageDef.stage);
    }
  }

  // The gateWeeks-based advised dates: the authoritative advised gate placement
  // and, index-aligned to stageMilestones, the advised milestone dates. This is
  // the advised date each dated point is reported against (specification: each
  // dated point is compared to its advised date from deriveAdvisedDates).
  const advised = deriveAdvisedDates(startEpoch, template, naStages, stageStates);
  const advisedByStage = new Map(advised.stages.map((s) => [s.stage, s]));

  // The window starts, the spacing anchor. deriveRollingGateDates rolls each gate
  // from the previous applicable gate's effective date (the developer's date where
  // set, otherwise the rolled advised date) and returns, per stage, the window
  // start its own dates are measured from: that same rolled anchor for a
  // sequential stage, and the declared window anchor for a concurrent one. Using
  // the rolled chain keeps the anchor continuous when a developer dates an early
  // gate away from advised, rather than jumping back to the absolute advised date.
  // Reading the window start from the one chain keeps this engine, the assembly
  // and the Brief measuring from the same point.
  const rolling = deriveRollingGateDates(
    startEpoch,
    template,
    choices,
    stageStates
  );
  const startByStage = new Map();
  for (const rollingStage of rolling.stages) {
    if (!rollingStage.applicable) continue;
    startByStage.set(
      rollingStage.stage,
      rollingStage.windowStart ? rollingStage.windowStart.getTime() : null
    );
  }

  const items = [];

  for (const stageDef of stageDefs) {
    const choice = choiceByStage.get(stageDef.stage) ?? {};
    const advisedStage = advisedByStage.get(stageDef.stage);
    const stageState = stageStateFor(stateByStage, stageDef.stage);

    // A not-applicable stage advises nothing and raises no item; the rolled start
    // chain already carried the anchor across it.
    if (choice.target_na === true || advisedStage?.applicable === false) {
      continue;
    }

    // A stage that was already complete before the project entered PULSE raises
    // no item either. Its dates record what happened, so there is no divergence
    // from a plan to reconcile and nothing to recommend.
    if (isComplete(stageState)) {
      continue;
    }

    // This stage's start: the previous applicable gate's effective date, or the
    // project start for the first applicable stage. Both the gate's implied span
    // and its milestones' implied offsets are measured from it. The rolling chain
    // (target_na) and this loop's skip (target_na or advisedStage.applicable)
    // agree today, so every checked stage has an entry; the fallback to the
    // advised stage start is defensive, so a future divergence between the two
    // skip rules can never leave the anchor undefined and emit NaN weeks.
    const stageStartEpoch =
      startByStage.get(stageDef.stage) ??
      (advisedStage?.stageStart ? advisedStage.stageStart.getTime() : startEpoch);
    const advisedGateDate = advisedStage?.gateAdvisedDate ?? null;
    const advisedMilestones = advisedStage?.milestones ?? [];

    // Headline milestones, in order, checked only where the developer dated them.
    // The offset is measured from this stage's effective start, the same anchor
    // the gate uses, and checked against the generous band around the curated
    // offset. Index-aligned to the advised milestones from deriveAdvisedDates.
    stageMilestones(stageDef).forEach((milestone, i) => {
      const milestoneChoice = (choice.milestones ?? {})[milestone.key] ?? {};
      const devEpoch = softEpoch(milestoneChoice.target_date);
      if (devEpoch == null) return;

      const weeks = weeksBetween(stageStartEpoch, devEpoch);
      const band = offsetBandFor(milestone, stageState);
      const withinBand = inBand(weeks, band);

      let tier = RECONCILE_TIERS.WITHIN_NORM;
      let recommendedDate = null;
      let reason = '';
      if (!withinBand) {
        tier = RECONCILE_TIERS.PROPOSE;
        recommendedDate = addWeeks(stageStartEpoch, milestone.offsetWeeks);
        const side = weeks < band.min ? 'below' : 'above';
        reason = offsetReason(weeks, band, side);
      }

      items.push({
        stage: stageDef.stage,
        kind: RECONCILE_ITEM_KINDS.MILESTONE,
        key: milestone.key,
        name: milestone.name,
        developerDate: new Date(devEpoch),
        advisedDate: advisedMilestones[i]?.advisedDate ?? null,
        implied: {
          basis: IMPLIED_BASES.STAGE_OFFSET,
          weeks,
          band,
          withinBand,
        },
        tier,
        recommendedDate,
        locationSensitive: false,
        reason,
      });
    });

    // The gate, checked only where the developer dated it. A gate bounds the
    // whole stage, so the implied stage span is checked against the summed
    // activity band, with the hard-floor and location-sensitive conditions taking
    // precedence over the spacing check.
    const gateEpoch = softEpoch(choice.target_date);
    if (gateEpoch != null) {
      const band = spanBandFor(stageDef, stageState);
      const weeks = weeksBetween(stageStartEpoch, gateEpoch);
      const withinBand = inBand(weeks, band);

      const isLocationSensitive =
        (stageDef.locationSensitive ?? []).length > 0;
      const floorWeeks = localFloors[stageDef.stage]?.floorWeeks;
      // A confirmed floor must be a real, non-negative number of weeks. A
      // malformed value (NaN, Infinity, negative) is treated as no confirmed
      // value, so a location-sensitive gate degrades to flag_verify rather than
      // silently clearing the verify prompt. A floor of zero is a valid confirmed
      // value: the local requirement was checked and carries no minimum.
      const hasConfirmedFloor =
        typeof floorWeeks === 'number' &&
        Number.isFinite(floorWeeks) &&
        floorWeeks >= 0;

      let tier;
      let recommendedDate = null;
      let reason = '';

      if (hasConfirmedFloor && weeks < floorWeeks) {
        // A confirmed local floor exists and is breached.
        tier = RECONCILE_TIERS.FORCE;
        recommendedDate = addWeeks(stageStartEpoch, floorWeeks);
        reason =
          `Gate date is below the confirmed local floor of ${floorWeeks} ` +
          `weeks after the stage start.`;
      } else if (isLocationSensitive && !hasConfirmedFloor) {
        // Location-sensitive with no confirmed local value: verify, do not block.
        // flag_verify deliberately dominates the spacing check, so recommendedDate
        // stays null here even if the span is out of band; the band breach is
        // still reported in `implied` (withinBand) for the 1.2 screen, and once
        // the developer confirms the local value the re-run yields the spacing
        // tier and its recommendation.
        tier = RECONCILE_TIERS.FLAG_VERIFY;
        const point = stageDef.locationSensitive[0];
        reason = `${point.label}: ${point.prompt}.`;
      } else if (!withinBand) {
        // The implied stage span diverges beyond the generous summed band.
        tier = RECONCILE_TIERS.PROPOSE;
        recommendedDate = addWeeks(stageStartEpoch, stageActivityWeeks(stageDef));
        const side = weeks < band.min ? 'below' : 'above';
        reason = spanReason(weeks, band, side);
      } else {
        tier = RECONCILE_TIERS.WITHIN_NORM;
      }

      items.push({
        stage: stageDef.stage,
        kind: RECONCILE_ITEM_KINDS.GATE,
        key: `gate_${stageDef.stage}`,
        name: stageDef.name,
        developerDate: new Date(gateEpoch),
        advisedDate: advisedGateDate,
        implied: {
          basis: IMPLIED_BASES.STAGE_SPAN,
          weeks,
          band,
          withinBand,
        },
        tier,
        recommendedDate,
        locationSensitive: isLocationSensitive,
        reason,
      });
    }
  }

  const counts = {
    [RECONCILE_TIERS.WITHIN_NORM]: 0,
    [RECONCILE_TIERS.PROPOSE]: 0,
    [RECONCILE_TIERS.FORCE]: 0,
    [RECONCILE_TIERS.FLAG_VERIFY]: 0,
  };
  for (const item of items) counts[item.tier] += 1;
  const anyFlagged = items.some(
    (item) => item.tier !== RECONCILE_TIERS.WITHIN_NORM
  );

  return {
    version: template?.version ?? null,
    projectStart: new Date(startEpoch),
    anyFlagged,
    counts,
    items,
  };
}
