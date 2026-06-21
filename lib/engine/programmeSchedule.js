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
