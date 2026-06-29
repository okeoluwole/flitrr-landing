/**
 * The Programme percent-complete engine (Programme module Phase 3.1). The first
 * pure engine of the tracking surface: it takes the frozen v1 baseline and a
 * met-points view and computes how far the programme has progressed, as a
 * duration-weighted average of activity progress, where each activity's progress
 * is read by how many of its points are met, not by the calendar.
 *
 * Pure and deterministic: no DB, no React, no network, no system clock, no read
 * of dates. It reads the baseline as plain input (it does not load it) and the
 * met-points view as plain input (the actuals store and the gate mechanic will
 * produce that view together later in this phase), and computes, so the same
 * inputs always give the same output and the module is unit-testable in
 * isolation. It mutates nothing it is given.
 *
 * THE INPUT IT READS:
 *
 *  - The baseline, the frozen assembled programme from a locked v1
 *    (lib/engine/programmeAssembly.js, stored by programmeBaselineStore.js):
 *    stages, each holding its ordered activities, each activity holding its
 *    duration (durationWeeks) and its milestones (each with a stable key), and
 *    each stage holding its gate (a key, gate_<stage>, and closesActivityKey, the
 *    key of the activity the gate closes). This engine reads structure and
 *    durations only. It never reads a baselineDate, a stageStart, or any date.
 *  - The met-points view, a map keyed by the point identifier as it appears in the
 *    baseline. Milestone keys and gate identifiers share one keyspace and never
 *    collide. A met point carries that it is met and its met date; the met date is
 *    not read here, only met or not met matters. A point not in the map is not met.
 *    A met record for a point the baseline does not contain is ignored, because the
 *    engine iterates the baseline and only ever looks a point up by its baseline
 *    key. Accepts the view as a plain object or a Map.
 *
 * THE POINT MODEL AND THE PROGRESS RULE:
 *
 *  - Each activity holds a set of points: all of its milestones, plus its stage's
 *    gate if it is the stage's closing activity (activity.key ===
 *    gate.closesActivityKey). A non-closing activity holds only its milestones.
 *  - An activity's progress is by count: the number of its points that are met over
 *    the number of points it holds. Not weighted by date, not by calendar position.
 *  - The closing-gate override: if an activity is the closing activity of its stage
 *    and its gate is met, its progress is one hundred percent regardless of its
 *    milestones, because passing the gate means the stage is complete.
 *  - An empty closing activity (no milestones) is scored by its gate alone, the
 *    single point it holds: zero while the gate is unmet, one hundred once met.
 *  - The defensive guard: if an activity somehow holds no points at all (not the
 *    expected path, since every real activity holds a milestone or its closing
 *    gate), it is excluded from the weighting rather than stranding the average
 *    below one hundred.
 *
 * THE DURATION WEIGHTING:
 *
 *  - The programme figure is the duration-weighted average of the activity progress
 *    figures, each activity weighted by its baseline duration. Only activities
 *    carry duration, so the weighting is over activities: an activity twice as long
 *    counts twice as much, so Construction, the longest stage with three
 *    activities, weighs heaviest.
 *  - The per-stage figure is the same duration-weighted average over that stage's
 *    activities, and the per-activity figure is the activity progress above. The
 *    three levels are returned together. The programme figure is the flat
 *    duration-weighted average over every counted activity, which equals the
 *    duration-weighted average of the stage figures, so the levels stay consistent.
 *  - Figures are computed precisely and never rounded here; display rounding is the
 *    surface's concern, so the weighted average is never distorted by intermediate
 *    rounding. Each figure is a number on the zero-to-one-hundred scale, or null
 *    where there is nothing to average (an empty programme, an all-skipped stage).
 *
 * NOT-APPLICABLE STAGES. A stage the developer marked not applicable (applicable
 * is false on the assembled baseline) is out of the programme: it neither scores
 * nor drags the figure, so its activities are reported uncounted and it does not
 * enter the average. Its skipped gate, which can never be met, is never held
 * against the figure. Only an explicit applicable === false skips a stage; an
 * absent flag is treated as applicable.
 *
 * OUT OF SCOPE HERE (the next sub-step and beyond): no RAG, no status colour, no
 * slip, no forecast, no dates beyond met or not, no persistence, no actuals store,
 * no gate mechanic, no reading of the baseline from the store.
 */

// One activity's baseline duration in weeks, the weight it carries in the
// duration-weighted average. The assembled baseline carries this as durationWeeks;
// a raw template activity carries it as typicalWeeks, accepted as a fallback so a
// hand-built fixture works too. A non-numeric or non-positive duration contributes
// no weight, so such an activity is still reported with its own figure but cannot
// move the average.
function activityWeight(activity) {
  const raw = activity?.durationWeeks ?? activity?.typicalWeeks;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/**
 * Whether a single point is met in the met-points view. A point is met when the
 * view holds an entry for it that is not explicitly unmet: the canonical entry is
 * { met: true, metDate }, but any present entry whose `met` is not false marks the
 * point met, which honours "a point not in the map is not met" while leaving an
 * explicit { met: false } as an escape hatch for a producer that records unmet
 * points. A bare truthy value is accepted too. The met date is never read here.
 * Accepts the view as a Map or a plain object keyed by the point id.
 */
function isPointMet(metView, key) {
  if (key == null || metView == null) return false;
  const record = metView instanceof Map ? metView.get(key) : metView[key];
  if (record == null) return false;
  if (typeof record === 'object') return record.met !== false;
  return Boolean(record);
}

/**
 * Derive one activity's progress node. Builds the activity's point set (its
 * milestones, plus the stage gate when it is the closing activity), counts how
 * many are met, applies the closing-gate override and the point-less guard, and
 * returns the figure with its working.
 */
function deriveActivityProgress(activity, gate, metView) {
  const closesStage =
    gate != null &&
    typeof gate.closesActivityKey === 'string' &&
    activity?.key === gate.closesActivityKey;
  const gateKey =
    closesStage && typeof gate?.key === 'string' ? gate.key : null;

  // The points this activity holds. A milestone with no key cannot be looked up
  // in the view, so it is not a trackable point and is skipped.
  const milestoneKeys = (activity?.milestones ?? [])
    .map((m) => m?.key)
    .filter((key) => key != null);
  const pointKeys = gateKey ? [...milestoneKeys, gateKey] : milestoneKeys;

  const totalPoints = pointKeys.length;
  const metPoints = pointKeys.reduce(
    (count, key) => (isPointMet(metView, key) ? count + 1 : count),
    0
  );
  const gateMet = gateKey != null && isPointMet(metView, gateKey);

  let percentComplete;
  let counted;
  let closedByGate = false;
  if (closesStage && gateMet) {
    // Closing-gate override: passing the gate completes the stage's final
    // activity regardless of any unmarked milestone beneath it.
    percentComplete = 100;
    counted = true;
    closedByGate = true;
  } else if (totalPoints === 0) {
    // Guard: an activity that holds no points is excluded from the weighting
    // rather than stranding the average below one hundred. Not an expected path.
    percentComplete = null;
    counted = false;
  } else {
    percentComplete = (metPoints / totalPoints) * 100;
    counted = true;
  }

  return {
    key: activity?.key ?? null,
    percentComplete,
    metPoints,
    totalPoints,
    durationWeeks: activityWeight(activity),
    counted,
    closesStage,
    closedByGate,
  };
}

/**
 * Compute the progress tree for a frozen baseline against a met-points view.
 *
 *   baseline   the frozen assembled programme (assembleProgramme's output, or the
 *              programme stored on a baseline row): { stages: [...] }. Read as
 *              plain input, never loaded here.
 *   metPoints  the met-points view: a plain object or Map keyed by the point id
 *              (milestone keys and gate keys in one keyspace), each entry marking
 *              the point met. Absent or empty means nothing is met.
 *
 * Returns the progress tree, every figure on the zero-to-one-hundred scale and
 * unrounded, or null where nothing can be averaged:
 *   {
 *     percentComplete,            the overall programme figure, duration-weighted
 *     stages: [
 *       {
 *         stage,                  the stage number
 *         applicable,             false for a stage marked not applicable
 *         percentComplete,        the per-stage figure, duration-weighted, or null
 *         activities: [
 *           {
 *             key,
 *             percentComplete,    the activity figure, or null when point-less
 *             metPoints,          points met (the working)
 *             totalPoints,        points held (the working)
 *             durationWeeks,      the activity's baseline duration, its weight
 *             counted,            whether it entered the weighting
 *             closesStage,        whether it is the stage's closing activity
 *             closedByGate,       whether the closing-gate override set it to 100
 *           }
 *         ]
 *       }
 *     ]
 *   }
 */
export function deriveProgress(baseline, metPoints) {
  const stageDefs = baseline?.stages ?? [];

  let programmeNum = 0;
  let programmeDen = 0;

  const stages = stageDefs.map((stage) => {
    const applicable = stage?.applicable !== false;
    const gate = stage?.gate ?? null;
    const activityDefs = stage?.activities ?? [];

    if (!applicable) {
      // A not-applicable stage neither scores nor drags the figure. Its
      // activities keep their shape but are uncounted, so the skipped gate, which
      // can never be met, is never held against the programme.
      return {
        stage: stage?.stage ?? null,
        applicable: false,
        percentComplete: null,
        activities: activityDefs.map((activity) => ({
          key: activity?.key ?? null,
          percentComplete: null,
          metPoints: 0,
          totalPoints: 0,
          durationWeeks: activityWeight(activity),
          counted: false,
          closesStage:
            gate != null &&
            typeof gate.closesActivityKey === 'string' &&
            activity?.key === gate.closesActivityKey,
          closedByGate: false,
        })),
      };
    }

    let stageNum = 0;
    let stageDen = 0;
    const activities = activityDefs.map((activity) => {
      const node = deriveActivityProgress(activity, gate, metPoints);
      if (node.counted) {
        stageNum += node.percentComplete * node.durationWeeks;
        stageDen += node.durationWeeks;
      }
      return node;
    });

    programmeNum += stageNum;
    programmeDen += stageDen;

    return {
      stage: stage?.stage ?? null,
      applicable: true,
      percentComplete: stageDen > 0 ? stageNum / stageDen : null,
      activities,
    };
  });

  return {
    percentComplete: programmeDen > 0 ? programmeNum / programmeDen : null,
    stages,
  };
}
