/**
 * Programme schedule derivation (Step 7 Brief programme update, sub-step 1a).
 * Turns a project start date plus the curated programme template (see
 * lib/engine/programmeTemplate.js) into advised dates for every gate and
 * milestone. Pure and deterministic: no DB, no React, no network, no system
 * clock, so the same inputs always give the same dates and the whole module is
 * unit-testable in isolation. It derives; it stores nothing.
 *
 * The two rules, both cumulative from the project start:
 *   - Gate advised date. Each stage's gate is the previous stage's gate advised
 *     date plus this stage's gate duration. Stage 0 has no previous gate, so it
 *     counts from the project start. The running date carries forward across the
 *     stages.
 *   - Milestone advised date. The start of a stage is the previous gate advised
 *     date (the project start for stage 0). A milestone falls at that stage
 *     start plus its offset.
 *
 * N/A stages. A stage marked N/A is skipped: it advises no gate and no
 * milestones, and the running gate date carries forward unchanged, so the next
 * applicable stage starts where the last applicable stage's gate left off.
 *
 * Weeks are whole seven-day spans added in UTC, so a result never drifts across
 * a daylight-saving boundary. Advised dates are returned as Date objects at the
 * same UTC instant as the project start (midnight UTC when the start is a plain
 * date), so read them with UTC methods.
 */

// One week in milliseconds. Weeks are whole seven-day spans, so adding them in
// epoch milliseconds is exact and timezone-neutral.
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Normalise the project start to epoch milliseconds. Accepts a Date, an ISO date
// string (a plain YYYY-MM-DD is parsed as UTC), or epoch milliseconds.
function toEpoch(projectStart) {
  if (projectStart instanceof Date) {
    const epoch = projectStart.getTime();
    if (Number.isNaN(epoch)) {
      throw new Error('deriveAdvisedDates: projectStart is an invalid Date');
    }
    return epoch;
  }
  if (typeof projectStart === 'number') return projectStart;
  if (typeof projectStart === 'string') {
    const epoch = Date.parse(projectStart);
    if (Number.isNaN(epoch)) {
      throw new Error('deriveAdvisedDates: projectStart is not a valid date string');
    }
    return epoch;
  }
  throw new Error(
    'deriveAdvisedDates: projectStart must be a Date, an ISO date string, or epoch milliseconds'
  );
}

// Add a whole number of weeks (zero or more) to an epoch, returning a Date.
function addWeeks(epochMs, weeks) {
  return new Date(epochMs + weeks * MS_PER_WEEK);
}

/**
 * Derive advised dates for the whole programme.
 *
 * projectStart  a Date, an ISO date string, or epoch milliseconds.
 * template      the programme template (PROGRAMME_TEMPLATE), or any object with
 *               the same { version, stages: [{ stage, name, gateWeeks,
 *               milestones, locationSensitive }] } shape.
 * naStages      optional iterable (array or Set) of stage numbers marked N/A.
 *
 * Returns:
 *   {
 *     version,           echoed from the template for traceability
 *     projectStart,      Date, the normalised start
 *     stages: [
 *       {
 *         stage, name,
 *         applicable,        false for an N/A stage
 *         gateWeeks,         the template's gate duration, for reference
 *         stageStart,        Date, or null when not applicable
 *         gateAdvisedDate,   Date, or null when not applicable
 *         milestones: [
 *           { name, serves, offsetWeeks, advisedDate }   advisedDate is a Date
 *         ],
 *         locationSensitive: [ { label, prompt } ]   passed through, flags only
 *       }
 *     ]
 *   }
 */
export function deriveAdvisedDates(projectStart, template, naStages) {
  const startEpoch = toEpoch(projectStart);
  const naSet = naStages instanceof Set ? naStages : new Set(naStages ?? []);

  // The running gate date, carried forward across stages. It begins at the
  // project start, which is the start of stage 0.
  let runningGateEpoch = startEpoch;

  const stages = (template?.stages ?? []).map((stageDef) => {
    if (naSet.has(stageDef.stage)) {
      // Skipped: no advised dates, and the running gate date is untouched, so it
      // carries forward to the next applicable stage.
      return {
        stage: stageDef.stage,
        name: stageDef.name,
        applicable: false,
        gateWeeks: stageDef.gateWeeks,
        stageStart: null,
        gateAdvisedDate: null,
        milestones: [],
        locationSensitive: [],
      };
    }

    const stageStartEpoch = runningGateEpoch;
    const gateAdvisedDate = addWeeks(stageStartEpoch, stageDef.gateWeeks);
    const milestones = (stageDef.milestones ?? []).map((milestone) => ({
      name: milestone.name,
      serves: milestone.serves,
      offsetWeeks: milestone.offsetWeeks,
      advisedDate: addWeeks(stageStartEpoch, milestone.offsetWeeks),
    }));

    // Carry the running gate date forward for the next applicable stage.
    runningGateEpoch = gateAdvisedDate.getTime();

    return {
      stage: stageDef.stage,
      name: stageDef.name,
      applicable: true,
      gateWeeks: stageDef.gateWeeks,
      stageStart: new Date(stageStartEpoch),
      gateAdvisedDate,
      milestones,
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

// Soft parse to epoch milliseconds, or null. Unlike toEpoch this never throws:
// an absent, empty or unparseable value (a not-yet-set project start, a blank
// date input) is simply "no date", so the rolling chain anchors on the next
// chosen date instead of erroring. Accepts a Date, an ISO date string (a plain
// YYYY-MM-DD is parsed as UTC), or epoch milliseconds.
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

// Normalise the supplied gate choices into a stage-keyed lookup of the two
// fields the rolling chain reads: the developer's chosen gate date (as epoch
// milliseconds, or null when unset) and the N/A flag. Accepts the programme
// choices object ({ stages: [...] }, as loadProgrammeChoices returns) or a
// plain array of per-gate choices; each entry carries { stage, target_date,
// target_na }. Anything else is treated as no choices.
function gateChoiceLookup(gateChoices) {
  const list = Array.isArray(gateChoices)
    ? gateChoices
    : (gateChoices?.stages ?? []);
  const lookup = new Map();
  for (const choice of list) {
    if (choice == null || choice.stage == null) continue;
    lookup.set(choice.stage, {
      chosenEpoch: softEpoch(choice.target_date),
      na: choice.target_na === true,
    });
  }
  return lookup;
}

/**
 * Derive the rolling advised gate dates from the developer's choices so far
 * (Step 7 Brief programme update, sub-step 1c). Pure and deterministic, like
 * deriveAdvisedDates: no DB, no React, no clock. It derives; it stores nothing.
 *
 * The rule, gate by gate in stage order:
 *   - A gate's advised date is the previous applicable gate's effective date
 *     plus this stage's gateWeeks. The effective date is the developer's chosen
 *     date if they set one, otherwise that gate's own advised date.
 *   - Gate 0 anchors on the project start (the start of stage 0).
 *   - An N/A stage is skipped: it advises no date, its duration is not added,
 *     and the anchor carries forward unchanged to the next applicable gate.
 *   - With no project start held yet, the anchor begins null, so an undated
 *     gate has no advised date until a chosen date seeds the chain; the later
 *     gates then roll from that previous chosen date.
 *
 * With no overrides (no chosen dates), every effective date equals the advised
 * date, so the advised dates match deriveAdvisedDates gate for gate. A chosen
 * date on one gate shifts only the gates after it, through the carried anchor.
 *
 * projectStart  a Date, an ISO date string, or epoch milliseconds; or empty
 *               (null, undefined or '') when no start date is held.
 * template      the programme template (PROGRAMME_TEMPLATE), or the same shape.
 * gateChoices   the programme choices ({ stages: [...] }) or a per-gate array,
 *               each entry carrying { stage, target_date, target_na }.
 *
 * Returns:
 *   {
 *     version,           echoed from the template
 *     projectStart,      Date, or null when no start date is held
 *     stages: [
 *       {
 *         stage, name,
 *         applicable,      false for an N/A gate
 *         gateWeeks,       the template's curated gate duration, for the hint
 *         advisedDate,     Date, or null (N/A, or no anchor yet)
 *         chosenDate,      Date, or null when the developer set no date
 *         effectiveDate,   Date, or null: the chosen date, else the advised date
 *       }
 *     ]
 *   }
 */
export function deriveRollingGateDates(projectStart, template, gateChoices) {
  const startEpoch = softEpoch(projectStart);
  const choiceByStage = gateChoiceLookup(gateChoices);

  // The anchor carried forward across stages: the previous applicable gate's
  // effective date. It begins at the project start, the start of stage 0, and
  // is null when no start date is held (an undated early gate then advises
  // nothing until a chosen date seeds the chain).
  let anchorEpoch = startEpoch;

  const stages = (template?.stages ?? []).map((stageDef) => {
    const choice = choiceByStage.get(stageDef.stage) ?? {};

    if (choice.na === true) {
      // Skipped: no advised date, its duration is not added, and the anchor
      // carries forward unchanged to the next applicable gate.
      return {
        stage: stageDef.stage,
        name: stageDef.name,
        applicable: false,
        gateWeeks: stageDef.gateWeeks,
        advisedDate: null,
        chosenDate: null,
        effectiveDate: null,
      };
    }

    const advisedDate =
      anchorEpoch == null ? null : addWeeks(anchorEpoch, stageDef.gateWeeks);
    const chosenEpoch = choice.chosenEpoch ?? null;
    // The effective date carried forward: the chosen date if the developer set
    // one, otherwise this gate's own advised date (which is null before a start
    // or chosen date has seeded the chain).
    const effectiveEpoch =
      chosenEpoch != null
        ? chosenEpoch
        : advisedDate == null
          ? null
          : advisedDate.getTime();
    anchorEpoch = effectiveEpoch;

    return {
      stage: stageDef.stage,
      name: stageDef.name,
      applicable: true,
      gateWeeks: stageDef.gateWeeks,
      advisedDate,
      chosenDate: chosenEpoch == null ? null : new Date(chosenEpoch),
      effectiveDate: effectiveEpoch == null ? null : new Date(effectiveEpoch),
    };
  });

  return {
    version: template?.version ?? null,
    projectStart: startEpoch == null ? null : new Date(startEpoch),
    stages,
  };
}
